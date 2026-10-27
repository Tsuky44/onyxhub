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

/**
 * Les épisodes d'une série qu'Onyx peut lire, par saison (`GET
 * /api/library/shows/:tmdb/episodes`, ADR-0082 d'Onyx) : une requête pour toutes
 * les saisons, sans fiche ni appel TMDB côté Onyx.
 */
export type OnyxShowEpisodes = ReadonlyMap<number, ReadonlySet<number>>

export async function fetchOnyxShowEpisodes(baseUrl: string, token: string, tmdbId: number): Promise<OnyxShowEpisodes> {
  const raw = await requestJson<{ seasons?: Record<string, number[]> }>(SERVICE, `${baseUrl}/api/library/shows/${tmdbId}/episodes`, {
    headers: { Authorization: `Bearer ${token}` },
    timeoutMs: 5_000,
  })
  const seasons = new Map<number, ReadonlySet<number>>()
  for (const [season, episodes] of Object.entries(raw.seasons ?? {})) {
    const number = Number(season)
    if (Number.isInteger(number) && number >= 0 && Array.isArray(episodes)) seasons.set(number, new Set(episodes.filter((episode) => Number.isInteger(episode) && episode > 0)))
  }
  return seasons
}

export function getOnyxShowEpisodes(token: string, tmdbId: number): Promise<OnyxShowEpisodes> {
  const baseUrl = onyxBaseUrl()
  if (!baseUrl) throw new NotConfiguredError(SERVICE)
  return fetchOnyxShowEpisodes(baseUrl, token, tmdbId)
}

export function getOnyxLibrary(token: string): Promise<OnyxLibraryIndex> {
  const baseUrl = onyxBaseUrl()
  if (!baseUrl) throw new NotConfiguredError(SERVICE)
  return fetchOnyxLibrary(baseUrl, token)
}
