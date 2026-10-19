import 'server-only'
import { NotConfiguredError, requestJson } from '../../http'
import { onyxBaseUrl } from './auth'
import type { OnyxNowPlaying, OnyxPlaybackStats, OnyxScanStatus, OnyxServerInfo } from './types'

const SERVICE = 'Onyx'

/**
 * Le résumé du serveur pour l'accueil admin, lu avec le jeton du compte
 * connecté : Onyx revérifie lui-même ses permissions (`manage_users` pour
 * l'activité et les stats), OnyxHub ne fait que relayer.
 */
export interface OnyxAdmin {
  nowPlaying(): Promise<OnyxNowPlaying[]>
  stats(days?: number): Promise<OnyxPlaybackStats>
  server(): Promise<OnyxServerInfo>
  scanStatus(): Promise<OnyxScanStatus>
}

export function createOnyxAdmin(baseUrl: string, token: string): OnyxAdmin {
  const get = <T>(path: string) =>
    requestJson<T>(SERVICE, `${baseUrl}${path}`, { headers: { Authorization: `Bearer ${token}` }, timeoutMs: 5_000 })
  return {
    nowPlaying: () => get('/api/admin/activity'),
    stats: (days = 30) => get(`/api/admin/stats?days=${Math.min(365, Math.max(1, Math.round(days)))}`),
    server: () => get('/api/admin/server'),
    scanStatus: () => get('/api/indexer/status'),
  }
}

export function getOnyxAdmin(token: string): OnyxAdmin {
  const baseUrl = onyxBaseUrl()
  if (!baseUrl) throw new NotConfiguredError(SERVICE)
  return createOnyxAdmin(baseUrl, token)
}
