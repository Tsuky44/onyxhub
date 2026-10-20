import 'server-only'
import { NotConfiguredError, requestJson } from '../../http'
import { onyxBaseUrl } from './auth'

const SERVICE = 'Onyx'

/**
 * Ce que la bibliothèque d'Onyx a, par identifiant TMDB : la fiche du serveur
 * de chaque film et de chaque série (`GET /api/library/tmdb-index`, ADR-0073
 * d'Onyx). Radarr et Sonarr disent ce qui est sur le disque ; ceci dit ce
 * qu'Onyx a indexé, donc ce qui se lit.
 */
export interface OnyxLibraryIndex {
  movies: ReadonlyMap<number, number>
  shows: ReadonlyMap<number, number>
}

function toMap(raw: Record<string, number> | undefined): Map<number, number> {
  const map = new Map<number, number>()
  for (const [tmdbId, mediaId] of Object.entries(raw ?? {})) {
    const id = Number(tmdbId)
    if (Number.isInteger(id) && id > 0 && Number.isInteger(mediaId) && mediaId > 0) map.set(id, mediaId)
  }
  return map
}

export async function fetchOnyxLibrary(baseUrl: string, token: string): Promise<OnyxLibraryIndex> {
  const raw = await requestJson<{ movies?: Record<string, number>; shows?: Record<string, number> }>(SERVICE, `${baseUrl}/api/library/tmdb-index`, {
    headers: { Authorization: `Bearer ${token}` },
    timeoutMs: 5_000,
  })
  return { movies: toMap(raw.movies), shows: toMap(raw.shows) }
}

export function getOnyxLibrary(token: string): Promise<OnyxLibraryIndex> {
  const baseUrl = onyxBaseUrl()
  if (!baseUrl) throw new NotConfiguredError(SERVICE)
  return fetchOnyxLibrary(baseUrl, token)
}
