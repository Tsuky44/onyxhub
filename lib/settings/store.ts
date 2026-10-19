import 'server-only'
import { eq, inArray } from 'drizzle-orm'
import { seal, unseal } from '../crypto'
import { getDb } from '../db'
import { settings } from '../db/schema'
import { findField, findService, type SettingField, type SettingKey } from './registry'

/** La valeur effective d'un réglage : variable d'environnement, puis base, puis valeur par défaut. */
export function getSetting(key: SettingKey): string | undefined {
  const field = findField(key)
  const fromEnv = field?.env ? process.env[field.env]?.trim() : undefined
  if (fromEnv) return fromEnv

  const row = getDb().select().from(settings).where(eq(settings.key, key)).get()
  if (row) {
    const value = row.encrypted ? unseal(row.value) : row.value
    // Un secret illisible (clé de chiffrement changée) compte comme absent :
    // Réglages l'affiche « à ressaisir » plutôt que d'envoyer du bruit au service.
    if (value) return value
  }
  return field?.fallback
}

/** Enregistre des réglages ensemble. Une valeur vide efface le réglage. */
export function setSettings(entries: Partial<Record<SettingKey, string>>): void {
  const db = getDb()
  db.transaction((tx) => {
    for (const [key, raw] of Object.entries(entries)) {
      const value = raw?.trim() ?? ''
      if (!value) {
        tx.delete(settings).where(eq(settings.key, key)).run()
        continue
      }
      const secret = findField(key)?.kind === 'secret'
      const row = { key, value: secret ? seal(value) : value, encrypted: secret, updatedAt: new Date() }
      tx.insert(settings).values(row).onConflictDoUpdate({ target: settings.key, set: row }).run()
    }
  })
}

/** Ce que le formulaire de Réglages peut savoir d'un champ, sans jamais recevoir un secret. */
export interface FieldSnapshot {
  key: string
  /** Valeur affichée ; toujours vide pour un secret. */
  value: string
  /** Un secret est enregistré (ou fourni par l'environnement). */
  isSet: boolean
  /** Variable d'environnement qui fixe ce champ, le cas échéant. */
  lockedBy: string | null
}

export function snapshotService(serviceId: string): FieldSnapshot[] {
  const service = findService(serviceId)
  if (!service) return []
  const keys = service.fields.map((field) => field.key)
  const rows = new Map(
    getDb().select().from(settings).where(inArray(settings.key, keys)).all().map((row) => [row.key, row]),
  )
  return service.fields.map((field: SettingField) => {
    const lockedBy = field.env && process.env[field.env]?.trim() ? field.env : null
    const row = rows.get(field.key)
    const stored = row ? (row.encrypted ? unseal(row.value) : row.value) : null
    const effective = lockedBy ? process.env[lockedBy]?.trim() ?? '' : stored ?? ''
    return {
      key: field.key,
      value: field.kind === 'secret' ? '' : effective,
      isSet: Boolean(effective),
      lockedBy,
    }
  })
}
