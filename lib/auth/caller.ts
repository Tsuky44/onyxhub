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
  /** `userId` : `X-Player-Id`, envoyé par les Onyx récents (ADR-0012) ; `null` sinon. */
  | { kind: 'onyx'; username: string; userId: number | null }
  | { kind: 'viewer'; username: string; userId: number; canRequest: boolean }
  | { kind: 'refused'; status: 401 | 403; message: string }

function playerId(request: Request): number | null {
  const id = Number(request.headers.get('x-player-id'))
  return Number.isInteger(id) && id > 0 ? id : null
}

/**
 * sorraa, pour ses routes : la clé qui lui est propre, ou la clé d'intégration
 * d'Onyx (celle des premières liaisons). Une clé à lui se donne et se change
 * sans toucher à Onyx (ADR-0017).
 */
export function resolveSorraaCaller(request: Request): { ok: true } | { ok: false; status: 401; message: string } {
  const presented = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!presented) return { ok: false, status: 401, message: "Clé d'intégration attendue." }
  const accepted = [getSetting('sorraa_hub_key'), getSetting('integration_api_key')].filter((key): key is string => Boolean(key))
  if (accepted.length === 0) return { ok: false, status: 401, message: 'Aucune clé pour sorraa dans OnyxHub : génère-la dans Réglages.' }
  if (!accepted.some((key) => safeEqual(presented, key))) return { ok: false, status: 401, message: 'Clé invalide.' }
  return { ok: true }
}

export async function resolveCaller(request: Request): Promise<Caller> {
  const authorization = request.headers.get('authorization')
  if (authorization) {
    const expected = getSetting('integration_api_key')
    const presented = authorization.replace(/^Bearer\s+/i, '').trim()
    if (!expected) return { kind: 'refused', status: 401, message: 'Clé d\'intégration non configurée dans OnyxHub.' }
    if (!presented || !safeEqual(presented, expected)) return { kind: 'refused', status: 401, message: 'Clé d\'intégration invalide.' }
    const username = request.headers.get('x-player-username')?.trim()
    // Sans nom de compte, la demande reste attribuée au serveur plutôt que refusée.
    if (!username) return { kind: 'onyx', username: 'Onyx', userId: null }
    return { kind: 'onyx', username, userId: playerId(request) }
  }

  const viewer = await getOptionalViewer()
  if (!viewer) return { kind: 'refused', status: 401, message: 'Connexion requise.' }
  return { kind: 'viewer', username: viewer.name, userId: viewer.id, canRequest: viewer.canRequest }
}
