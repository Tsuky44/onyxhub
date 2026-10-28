import 'server-only'
import { errorMessage } from '../http'
import { getSorraa, type SorraaLibraryMedia, type SorraaRequest, type SorraaState, type SorraaUnit } from '../services/sorraa/client'
import type { MediaType } from '../services/tmdb/types'
import { TtlCache } from '../ttl-cache'
import { availabilityOfStatus, seasonStatus, seriesFromSeasons, UNKNOWN_AVAILABILITY, type Availability, type SeasonAvailability } from './availability'
import type { AvailabilityStatus } from './status'

/**
 * La disponibilité d'après sorraa, quand il est branché (ADR-0015) : ce qu'il
 * possède (ses fichiers, unité par unité) et où en sont les demandes qu'il
 * sert. Radarr et Sonarr ne comptent alors plus : Onyx reçoit, par les routes
 * de disponibilité, ce que sorraa sait.
 *
 * Toute la bibliothèque de sorraa et toutes ses demandes se lisent d'un
 * passage, gardées 60 s : une page de vingt cartes ne coûte aucun appel de plus.
 */
export interface SorraaIndex {
  media: ReadonlyMap<string, SorraaLibraryMedia>
  requests: ReadonlyMap<string, readonly SorraaRequest[]>
}

const TTL_MS = 60_000
/** sorraa en panne : on réessaie vite, mais pas à chaque carte (chaque essai attend son délai). */
const FAILURE_TTL_MS = 10_000

const cache = new TtlCache<SorraaIndex>(TTL_MS, 1)
let failedUntil = 0

const keyOf = (mediaType: MediaType, tmdbId: number) => `${mediaType}:${tmdbId}`
const mediaTypeOf = (kind: 'movie' | 'series'): MediaType => (kind === 'movie' ? 'movie' : 'tv')

export function buildSorraaIndex(media: readonly SorraaLibraryMedia[], requests: readonly SorraaRequest[]): SorraaIndex {
  const requestsByKey = new Map<string, SorraaRequest[]>()
  for (const request of requests) {
    const key = keyOf(mediaTypeOf(request.kind), request.tmdbId)
    requestsByKey.set(key, [...(requestsByKey.get(key) ?? []), request])
  }
  return { media: new Map(media.map((item) => [keyOf(mediaTypeOf(item.kind), item.tmdbId), item])), requests: requestsByKey }
}

/**
 * L'index de sorraa, ou `null` quand il ne répond pas : la disponibilité est un
 * enrichissement, une carte sans statut vaut mieux qu'une page qui plante.
 */
export async function getSorraaIndex(): Promise<SorraaIndex | null> {
  if (Date.now() < failedUntil) return null
  try {
    return await cache.load('index', async () => {
      const sorraa = getSorraa()
      const [media, requests] = await Promise.all([sorraa.library(), sorraa.allRequests()])
      return buildSorraaIndex(media, requests)
    })
  } catch (error) {
    failedUntil = Date.now() + FAILURE_TTL_MS
    console.warn(`[disponibilité] sorraa : ${errorMessage(error)}`)
    return null
  }
}

/** À appeler après tout changement chez sorraa (demande, retrait, événement). */
export function invalidateSorraaIndex(): void {
  cache.clear()
  failedUntil = 0
}

const ORDER: readonly SorraaState[] = ['pending', 'processing', 'partial', 'available']
const furthest = (states: readonly SorraaState[]): SorraaState | undefined =>
  states.reduce<SorraaState | undefined>((best, state) => (best === undefined || ORDER.indexOf(state) > ORDER.indexOf(best) ? state : best), undefined)

/** Un fichier est là pour cette unité. `upgradable` en a un, d'une qualité qu'on peut encore améliorer. */
const hasFile = (unit: SorraaUnit) => unit.status === 'downloaded' || unit.status === 'upgradable'

function movieIn(media: SorraaLibraryMedia | undefined, requests: readonly SorraaRequest[]): Availability {
  if (media?.units.some((unit) => unit.kind === 'movie' && hasFile(unit))) return availabilityOfStatus('available')
  const reported = furthest(requests.map((request) => request.state))
  if (reported === 'available') return availabilityOfStatus('available')
  if (reported === 'processing' || reported === 'partial') return availabilityOfStatus('processing')
  if (reported === 'pending') return availabilityOfStatus('pending')
  return UNKNOWN_AVAILABILITY
}

function seriesIn(media: SorraaLibraryMedia | undefined, requests: readonly SorraaRequest[]): Availability {
  const episodes = (media?.units ?? []).filter((unit) => unit.kind === 'episode' && unit.seasonNumber !== undefined)
  const requested = (season: number) => requests.flatMap((request) => request.seasons?.filter((entry) => entry.number === season).map((entry) => entry.state) ?? [])

  const numbers = new Set([...episodes.map((unit) => unit.seasonNumber!), ...requests.flatMap((request) => request.seasons?.map((entry) => entry.number) ?? [])])
  const seasons = [...numbers]
    .sort((a, b) => a - b)
    .map((seasonNumber): SeasonAvailability => {
      // Les épisodes pas encore diffusés comptent : une saison en cours de
      // diffusion reste « partielle » jusqu'au dernier, comme chez Sonarr.
      const inSeason = episodes.filter((unit) => unit.seasonNumber === seasonNumber)
      const episodeFileCount = inSeason.filter(hasFile).length
      const totalEpisodes = inSeason.length
      const reported = furthest(requested(seasonNumber))
      // « pending » ne vient que d'une demande : une saison seulement suivie dans la bibliothèque n'est pas « demandée ».
      const status: AvailabilityStatus = seasonStatus(totalEpisodes > 0 && episodeFileCount >= totalEpisodes, reported === 'processing', episodeFileCount > 0, reported === 'pending')
      return { seasonNumber, status, available: episodeFileCount > 0, totalEpisodes, episodeFileCount }
    })
  return seasons.length === 0 ? UNKNOWN_AVAILABILITY : seriesFromSeasons(seasons)
}

/** La disponibilité d'un média d'après l'index de sorraa. Pure. */
export function sorraaAvailabilityIn(index: SorraaIndex, mediaType: MediaType, tmdbId: number): Availability {
  const key = keyOf(mediaType, tmdbId)
  const media = index.media.get(key)
  const requests = index.requests.get(key) ?? []
  return mediaType === 'movie' ? movieIn(media, requests) : seriesIn(media, requests)
}
