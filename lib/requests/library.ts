import 'server-only'
import { errorMessage, NotConfiguredError } from '../http'
import { getRadarr } from '../services/arr/radarr'
import { getSonarr } from '../services/arr/sonarr'
import type { QueueItem, RadarrMovie, SonarrSeries } from '../services/arr/types'
import { movieAvailability, seriesAvailability, UNKNOWN_AVAILABILITY, type Availability } from './availability'
import type { MediaType } from '../services/tmdb/types'
import { invalidateSorraaIndex } from './sorraa-availability'

/**
 * Ce que Radarr et Sonarr ont, lu en une fois : toute la bibliothèque et la
 * file de téléchargement, gardées 60 s.
 *
 * MediaHub interrogeait Radarr ou Sonarr **par carte** (`/movie/lookup`,
 * plus TMDB pour l'identifiant TVDB) : une page de découverte coûtait une
 * quarantaine d'appels. Ici, quatre appels servent toutes les cartes, la
 * fiche, la liste des demandes et le serveur Onyx pendant une minute.
 */
export interface LibraryIndex {
  movies: Map<number, RadarrMovie>
  seriesByTmdb: Map<number, SonarrSeries>
  seriesByTvdb: Map<number, SonarrSeries>
  /** Identifiants Radarr des films dans la file. */
  downloadingMovies: Set<number>
  /** Saisons dans la file, par identifiant de série Sonarr. */
  downloadingSeasons: Map<number, Set<number>>
  movieQueue: QueueItem[]
  seriesQueue: QueueItem[]
  radarr: boolean
  sonarr: boolean
}

const TTL_MS = 60_000
/** Un *arr en panne : on réessaie vite plutôt que de servir une bibliothèque vide pendant une minute. */
const ERROR_TTL_MS = 10_000

let cached: { index: LibraryIndex; expiresAt: number } | null = null
let inFlight: Promise<LibraryIndex> | null = null
// Une invalidation pendant un chargement rend ce chargement périmé : il ne doit pas remplir le cache.
let generation = 0

// Un téléchargement fini ou en échec reste un moment dans la file : il ne compte plus.
const DONE_STATES = new Set(['imported', 'failed', 'failedpending', 'ignored'])

function isActive(item: QueueItem): boolean {
  return !DONE_STATES.has((item.trackedDownloadState ?? '').toLowerCase())
}

async function settle<T>(service: string, load: () => Promise<T>, empty: T): Promise<{ value: T; configured: boolean; failed: boolean }> {
  try {
    return { value: await load(), configured: true, failed: false }
  } catch (error) {
    if (error instanceof NotConfiguredError) return { value: empty, configured: false, failed: false }
    console.warn(`[bibliothèque] ${service} : ${errorMessage(error)}`)
    return { value: empty, configured: true, failed: true }
  }
}

export function buildIndex(
  movies: readonly RadarrMovie[],
  series: readonly SonarrSeries[],
  movieQueue: readonly QueueItem[],
  seriesQueue: readonly QueueItem[],
  flags: { radarr: boolean; sonarr: boolean },
): LibraryIndex {
  const index: LibraryIndex = {
    movies: new Map(),
    seriesByTmdb: new Map(),
    seriesByTvdb: new Map(),
    downloadingMovies: new Set(),
    downloadingSeasons: new Map(),
    movieQueue: movieQueue.filter(isActive),
    seriesQueue: seriesQueue.filter(isActive),
    ...flags,
  }
  for (const movie of movies) index.movies.set(movie.tmdbId, movie)
  for (const show of series) {
    // Sonarr v3 ne donne pas toujours l'identifiant TMDB : la table TVDB sert alors.
    if (show.tmdbId) index.seriesByTmdb.set(show.tmdbId, show)
    index.seriesByTvdb.set(show.tvdbId, show)
  }
  for (const item of index.movieQueue) {
    if (item.movieId) index.downloadingMovies.add(item.movieId)
  }
  for (const item of index.seriesQueue) {
    const seasonNumber = item.episode?.seasonNumber ?? item.seasonNumber
    if (!item.seriesId || seasonNumber === undefined) continue
    const seasons = index.downloadingSeasons.get(item.seriesId) ?? new Set<number>()
    seasons.add(seasonNumber)
    index.downloadingSeasons.set(item.seriesId, seasons)
  }
  return index
}

async function loadIndex(): Promise<{ index: LibraryIndex; failed: boolean }> {
  const [movies, series, movieQueue, seriesQueue] = await Promise.all([
    settle('Radarr', () => getRadarr().movies(), [] as RadarrMovie[]),
    settle('Sonarr', () => getSonarr().allSeries(), [] as SonarrSeries[]),
    settle('Radarr', () => getRadarr().queue(), [] as QueueItem[]),
    settle('Sonarr', () => getSonarr().queue(), [] as QueueItem[]),
  ])
  const index = buildIndex(movies.value, series.value, movieQueue.value, seriesQueue.value, {
    radarr: movies.configured,
    sonarr: series.configured,
  })
  return { index, failed: movies.failed || series.failed }
}

/** L'index de bibliothèque, chargé au plus une fois par minute (et une seule fois pour des appels simultanés). */
export async function getLibrary(): Promise<LibraryIndex> {
  if (cached && cached.expiresAt > Date.now()) return cached.index
  if (inFlight) return inFlight
  const started = generation
  const load = loadIndex()
    .then(({ index, failed }) => {
      if (started === generation) cached = { index, expiresAt: Date.now() + (failed ? ERROR_TTL_MS : TTL_MS) }
      return index
    })
    .finally(() => {
      if (inFlight === load) inFlight = null
    })
  inFlight = load
  return load
}

/** À appeler après tout changement côté Radarr/Sonarr ou sorraa (demande, suppression, webhook). */
export function invalidateLibrary(): void {
  generation++
  cached = null
  inFlight = null
  invalidateSorraaIndex()
}

export function findSeries(index: LibraryIndex, tmdbId: number, tvdbId?: number | null): SonarrSeries | undefined {
  return index.seriesByTmdb.get(tmdbId) ?? (tvdbId ? index.seriesByTvdb.get(tvdbId) : undefined)
}

export function availabilityIn(index: LibraryIndex, type: MediaType, tmdbId: number, tvdbId?: number | null): Availability {
  if (type === 'movie') {
    const movie = index.movies.get(tmdbId)
    return movieAvailability(movie, movie?.id !== undefined && index.downloadingMovies.has(movie.id))
  }
  const series = findSeries(index, tmdbId, tvdbId)
  if (!series?.id) return UNKNOWN_AVAILABILITY
  return seriesAvailability(series, index.downloadingSeasons.get(series.id) ?? new Set())
}
