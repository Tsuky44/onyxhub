import type { ServiceDefinition, SettingField } from './registry'

/**
 * Lecture et validation d'un formulaire de service, sans dépendance au
 * serveur : testable seul, et la seule source des règles de saisie.
 */
export interface ParsedServiceForm {
  /** Valeurs à enregistrer. Un secret laissé vide n'y figure pas : on garde l'ancien. */
  updates: Record<string, string>
  /** Message par clé de champ invalide. */
  errors: Record<string, string>
}

function validate(field: SettingField, value: string): string | null {
  if (!value) return null
  if (field.kind === 'url') {
    try {
      const url = new URL(value)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'L\'adresse doit commencer par http:// ou https://'
    } catch {
      // `new URL` lève sur toute saisie mal formée : c'est le verdict cherché.
      return 'Adresse invalide (exemple : http://192.168.1.10:7878)'
    }
  }
  if (field.kind === 'number') {
    const number = Number(value)
    if (!Number.isInteger(number)) return 'Un nombre entier est attendu'
    if (field.min !== undefined && number < field.min) return `${field.min} minimum`
    if (field.max !== undefined && number > field.max) return `${field.max} maximum`
  }
  return null
}

/** Les champs verrouillés par une variable d'environnement ne sont pas lus : ils arrivent désactivés. */
export function parseServiceForm(service: ServiceDefinition, form: FormData, locked: ReadonlySet<string>): ParsedServiceForm {
  const updates: Record<string, string> = {}
  const errors: Record<string, string> = {}
  for (const field of service.fields) {
    if (locked.has(field.key)) continue
    const raw = form.get(field.key)
    const value = typeof raw === 'string' ? (field.kind === 'secret' ? raw : raw.trim()) : ''
    if (field.kind === 'secret' && !value) continue
    const error = validate(field, value)
    if (error) errors[field.key] = error
    else updates[field.key] = field.kind === 'url' ? value.replace(/\/+$/, '') : value
  }
  return { updates, errors }
}
