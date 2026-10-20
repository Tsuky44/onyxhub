import 'server-only'
import { eachLimited } from '../concurrency'
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

/**
 * Les disponibilités d'une page du catalogue d'Onyx (`POST
 * /api/media/availability`, ADR-0009). Même réponse que la route unitaire
 * pour chaque média, mais l'index n'est lu qu'une fois. Le repli par TVDB
 * (un appel TMDB par série) ne sert que si Sonarr range des séries sans
 * identifiant TMDB : sinon une série absente de l'index est vraiment absente.
 */
export async function availabilityBatch(items: readonly { mediaType: MediaType; tmdbId: number }[]): Promise<Availability[]> {
  const index = await getLibrary()
  const known = availabilityMap(index, items)
  const someSeriesLackTmdb = index.seriesByTvdb.size > index.seriesByTmdb.size
  const results = items.map((item) => known.get(`${item.mediaType}:${item.tmdbId}`) ?? UNKNOWN_AVAILABILITY)
  if (!someSeriesLackTmdb) return results
  await eachLimited(
    items.flatMap((item, position) => (item.mediaType === 'tv' && results[position]!.status === 'unknown' && !index.seriesByTmdb.has(item.tmdbId) ? [position] : [])),
    4,
    async (position) => {
      const item = items[position]!
      results[position] = await mediaAvailability('tv', item.tmdbId).catch(() => UNKNOWN_AVAILABILITY)
    },
  )
  return results
}

/** Les disponibilités d'une page de cartes, sans aucun appel par carte. */
export function availabilityMap(index: LibraryIndex, items: readonly { mediaType: MediaType; tmdbId: number }[]): Map<string, Availability> {
  const tvdb = knownTvdbIds(items.filter((item) => item.mediaType === 'tv').map((item) => item.tmdbId))
  return new Map(items.map((item) => [`${item.mediaType}:${item.tmdbId}`, availabilityIn(index, item.mediaType, item.tmdbId, tvdb.get(item.tmdbId))]))
}
