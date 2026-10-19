'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/viewer'
import { randomToken } from '@/lib/crypto'
import { parseServiceForm } from '@/lib/settings/form'
import { findService, type ServiceId, type SettingKey } from '@/lib/settings/registry'
import { getSetting, setSettings, snapshotService } from '@/lib/settings/store'
import { testService, type Values } from '@/lib/settings/testers'

export type ServiceFormState =
  | { kind: 'idle' }
  | { kind: 'saved'; message: string; cleared?: boolean }
  | { kind: 'tested'; ok: boolean; message: string }
  | { kind: 'invalid'; errors: Record<string, string> }
  | { kind: 'generated'; key: string }
  | { kind: 'error'; message: string }

/** Les valeurs à tester : celles du formulaire, complétées par l'enregistré pour les secrets laissés vides et les champs verrouillés. */
function valuesForTest(serviceId: ServiceId, updates: Record<string, string>): Values {
  const service = findService(serviceId)
  const values: Values = {}
  for (const field of service?.fields ?? []) {
    values[field.key] = field.key in updates ? updates[field.key] : getSetting(field.key as SettingKey)
  }
  return values
}

/**
 * Une seule action par carte de service ; le bouton cliqué dit l'intention
 * (`intent` = test, save, clear ou generate). Chaque appel revérifie le droit
 * admin : être appelée depuis la page Réglages ne prouve rien.
 */
export async function serviceAction(serviceId: ServiceId, _previous: ServiceFormState, form: FormData): Promise<ServiceFormState> {
  await requireAdmin()
  const service = findService(serviceId)
  if (!service) return { kind: 'error', message: 'Service inconnu.' }

  const intent = form.get('intent')

  if (intent === 'generate') {
    if (!service.generates) return { kind: 'error', message: 'Action inconnue.' }
    const key = randomToken()
    setSettings({ [service.generates as SettingKey]: key })
    revalidatePath('/reglages')
    return { kind: 'generated', key }
  }

  const locked = new Set(snapshotService(serviceId).filter((field) => field.lockedBy).map((field) => field.key))

  if (intent === 'clear') {
    if (serviceId === 'onyx') {
      return { kind: 'error', message: "L'adresse d'Onyx ne peut pas être retirée : plus personne ne pourrait se connecter." }
    }
    const cleared = Object.fromEntries(service.fields.filter((field) => !locked.has(field.key)).map((field) => [field.key, '']))
    setSettings(cleared)
    revalidatePath('/reglages')
    return { kind: 'saved', message: 'Réglages retirés.', cleared: true }
  }

  const { updates, errors } = parseServiceForm(service, form, locked)
  if (Object.keys(errors).length > 0) return { kind: 'invalid', errors }

  if (intent === 'test') {
    const result = await testService(serviceId, valuesForTest(serviceId, updates))
    return { kind: 'tested', ...result }
  }

  // Changer l'adresse d'Onyx pour une adresse qui ne répond pas déconnecterait
  // tout le monde, admin compris : on la teste avant de l'enregistrer.
  if (serviceId === 'onyx' && 'onyx_url' in updates) {
    if (!updates.onyx_url) return { kind: 'invalid', errors: { onyx_url: "L'adresse d'Onyx est obligatoire." } }
    const result = await testService('onyx', updates)
    if (!result.ok) return { kind: 'tested', ...result }
  }

  setSettings(updates)
  revalidatePath('/reglages')
  return { kind: 'saved', message: 'Enregistré.' }
}
