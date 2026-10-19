import 'server-only'
import { safeEqual } from '../crypto'
import { getSetting } from '../settings/store'
import { getOptionalViewer } from './viewer'

/**
 * Qui appelle une route du contrat Onyx (ADR-0002) : le serveur Onyx, avec la
 * clé d'intégration et le nom du compte dans `X-Player-Username`, ou un
 * navigateur connecté à OnyxHub.
 *
 * Le serveur Onyx vérifie lui-même la permission `request_media` avant de
 * relayer une demande (`RequirePermission` dans son routeur) : la clé
 * d'intégration suffit donc à demander au nom du compte transmis.
 */
export type Caller =
  | { kind: 'onyx'; username: string }
  | { kind: 'viewer'; username: string; canRequest: boolean }
  | { kind: 'refused'; status: 401 | 403; message: string }

export async function resolveCaller(request: Request): Promise<Caller> {
  const authorization = request.headers.get('authorization')
  if (authorization) {
    const expected = getSetting('integration_api_key')
    const presented = authorization.replace(/^Bearer\s+/i, '').trim()
    if (!expected) return { kind: 'refused', status: 401, message: 'Clé d\'intégration non configurée dans OnyxHub.' }
    if (!presented || !safeEqual(presented, expected)) return { kind: 'refused', status: 401, message: 'Clé d\'intégration invalide.' }
    const username = request.headers.get('x-player-username')?.trim()
    // Sans nom de compte, la demande reste attribuée au serveur plutôt que refusée.
    return { kind: 'onyx', username: username || 'Onyx' }
  }

  const viewer = await getOptionalViewer()
  if (!viewer) return { kind: 'refused', status: 401, message: 'Connexion requise.' }
  return { kind: 'viewer', username: viewer.name, canRequest: viewer.canRequest }
}
