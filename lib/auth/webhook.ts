import 'server-only'
import { safeEqual } from '../crypto'
import { getSetting } from '../settings/store'

/**
 * Les webhooks Radarr/Sonarr présentent le secret de Réglages, dans l'URL
 * (`?secret=`, le seul champ que tous les *arr savent remplir) ou dans
 * l'en-tête `X-Webhook-Secret`. MediaHub acceptait tout tant qu'aucun secret
 * n'était configuré ; ici, sans secret, les webhooks sont refusés.
 */
export function webhookAuthorized(request: Request): boolean {
  const expected = getSetting('webhook_secret')
  if (!expected) return false
  const presented = new URL(request.url).searchParams.get('secret') ?? request.headers.get('x-webhook-secret') ?? ''
  return presented.length > 0 && safeEqual(presented, expected)
}
