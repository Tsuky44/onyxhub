import 'server-only'
import { getTmdb } from '../services/tmdb/client'
import type { MediaType } from '../services/tmdb/types'
import { UNKNOWN_AVAILABILITY, type Availability } from './availability'
import { availabilityIn, getLibrary, type LibraryIndex } from './library'
import { knownTvdbIds } from './repository'

/**
 * La disponibilité d'un média précis (fiche, serveur Onyx). Une série que
 * Sonarr v3 range sans identifiant TMDB est retrouvée par son identifiant
 * TVDB : celui des demandes s'il est connu, sinon celui de TMDB (gardé 24 h).
 */
export async function mediaAvailability(type: MediaType, tmdbId: number, tvdbId?: number | null): Promise<Availability> {
  const index = await getLibrary()
  const direct = availabilityIn(index, type, tmdbId, tvdbId)
  if (type === 'movie' || direct.status !== 'unknown' || index.seriesByTmdb.has(tmdbId)) return direct
  const fallback = tvdbId ?? knownTvdbIds([tmdbId]).get(tmdbId) ?? (await getTmdb().externalIds('tv', tmdbId).catch(() => null))?.tvdb_id
  return fallback ? availabilityIn(index, type, tmdbId, fallback) : UNKNOWN_AVAILABILITY
}

/** Les disponibilités d'une page de cartes, sans aucun appel par carte. */
export function availabilityMap(index: LibraryIndex, items: readonly { mediaType: MediaType; tmdbId: number }[]): Map<string, Availability> {
  const tvdb = knownTvdbIds(items.filter((item) => item.mediaType === 'tv').map((item) => item.tmdbId))
  return new Map(items.map((item) => [`${item.mediaType}:${item.tmdbId}`, availabilityIn(index, item.mediaType, item.tmdbId, tvdb.get(item.tmdbId))]))
}
