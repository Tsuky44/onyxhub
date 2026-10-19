import 'server-only'
import { NotConfiguredError, normalizeBaseUrl, ServiceError } from '../../http'
import { getSetting } from '../../settings/store'
import { arrVersion, createArrClient, type ArrConfig } from './client'
import type { ArrRelease, DiskSpace, HealthCheck, QualityProfile, QueueItem, RadarrCalendarMovie, RadarrMovie, RootFolder } from './types'

const SERVICE = 'Radarr'

/** Ce qu'a donné une demande de film, pour le message à l'utilisateur et la ligne de demande. */
export type MovieRequestOutcome =
  | { kind: 'added'; movie: RadarrMovie }
  | { kind: 'monitored'; movie: RadarrMovie }
  | { kind: 'already-requested'; movie: RadarrMovie }
  | { kind: 'available'; movie: RadarrMovie }

export interface Radarr {
  version(): Promise<string | null>
  qualityProfiles(): Promise<QualityProfile[]>
  rootFolders(): Promise<RootFolder[]>
  diskSpace(): Promise<DiskSpace[]>
  health(): Promise<HealthCheck[]>
  /** Toute la bibliothèque Radarr (index de disponibilité). */
  movies(): Promise<RadarrMovie[]>
  /** Le film s'il est dans la bibliothèque Radarr, `null` sinon. */
  movieByTmdbId(tmdbId: number): Promise<RadarrMovie | null>
  setMonitored(movieId: number, monitored: boolean): Promise<RadarrMovie>
  /**
   * Demande un film : l'ajoute s'il est absent, le surveille s'il était
   * ignoré, ne fait rien s'il est déjà demandé ou disponible. Lance la
   * recherche dans les deux premiers cas.
   */
  requestMovie(tmdbId: number): Promise<MovieRequestOutcome>
  deleteMovie(movieId: number, deleteFiles: boolean): Promise<void>
  queue(): Promise<QueueItem[]>
  removeFromQueue(queueId: number, options: { blocklist?: boolean; removeFromClient?: boolean }): Promise<void>
  calendar(start: Date, end: Date): Promise<RadarrCalendarMovie[]>
  releases(movieId: number): Promise<ArrRelease[]>
  grabRelease(release: Pick<ArrRelease, 'guid' | 'indexerId'>): Promise<void>
  search(movieId: number): Promise<void>
}

export function createRadarr(config: ArrConfig): Radarr {
  const api = createArrClient(SERVICE, 'v3', config)

  async function defaults(): Promise<{ qualityProfileId: number; rootFolderPath: string }> {
    const [profiles, folders] = await Promise.all([radarr.qualityProfiles(), radarr.rootFolders()])
    const profile = profiles[0]
    const folder = folders[0]
    // Comme MediaHub : premier profil, premier dossier racine. Sans eux, Radarr refuserait l'ajout.
    if (!profile || !folder) throw new ServiceError(SERVICE, 'Radarr n\'a ni profil de qualité ni dossier racine : configure-les dans Radarr')
    return { qualityProfileId: profile.id, rootFolderPath: folder.path }
  }

  const radarr: Radarr = {
    version: () => arrVersion(api),
    qualityProfiles: () => api.getStatic('/qualityprofile'),
    rootFolders: () => api.getStatic('/rootfolder'),
    diskSpace: () => api.get('/diskspace'),
    health: () => api.get('/health'),
    movies: () => api.get('/movie', {}, 30_000),
    async movieByTmdbId(tmdbId) {
      // `/movie?tmdbId=` ne lit que la bibliothèque locale. MediaHub passait
      // par `/movie/lookup`, qui interroge en plus le serveur de métadonnées
      // de Radarr à chaque affichage d'une fiche.
      const movies = await api.get<RadarrMovie[]>('/movie', { tmdbId })
      return movies[0] ?? null
    },
    async requestMovie(tmdbId) {
      const existing = await radarr.movieByTmdbId(tmdbId)
      if (existing?.id) {
        if (existing.hasFile) return { kind: 'available', movie: existing }
        if (existing.monitored) return { kind: 'already-requested', movie: existing }
        const movie = await api.put<RadarrMovie>(`/movie/${existing.id}`, { ...existing, monitored: true })
        await radarr.search(existing.id)
        return { kind: 'monitored', movie }
      }
      const [lookup, target] = await Promise.all([api.get<RadarrMovie>('/movie/lookup/tmdb', { tmdbId }), defaults()])
      const movie = await api.post<RadarrMovie>('/movie', {
        ...lookup,
        ...target,
        monitored: true,
        minimumAvailability: 'announced',
        // La recherche part en commande séparée : l'ajout répond vite, même si l'indexeur est lent.
        addOptions: { searchForMovie: false },
      })
      if (movie.id) await radarr.search(movie.id)
      return { kind: 'added', movie }
    },
    async setMonitored(movieId, monitored) {
      const movie = await api.get<RadarrMovie>(`/movie/${movieId}`)
      return api.put<RadarrMovie>(`/movie/${movieId}`, { ...movie, monitored })
    },
    async deleteMovie(movieId, deleteFiles) {
      await api.delete(`/movie/${movieId}`, { deleteFiles, addImportExclusion: false })
    },
    async queue() {
      const page = await api.get<{ records?: QueueItem[] } | QueueItem[]>('/queue', {
        pageSize: 1000,
        includeMovie: true,
        includeUnknownMovieItems: false,
      })
      return Array.isArray(page) ? page : (page.records ?? [])
    },
    async removeFromQueue(queueId, { blocklist = false, removeFromClient = true }) {
      await api.delete(`/queue/${queueId}`, { removeFromClient, blocklist })
    },
    calendar: (start, end) =>
      api.get('/calendar', { start: start.toISOString(), end: end.toISOString(), unmonitored: false }),
    // Radarr interroge chaque indexeur en direct : une recherche interactive peut prendre une minute.
    releases: (movieId) => api.get('/release', { movieId }, 120_000),
    async grabRelease({ guid, indexerId }) {
      await api.post('/release', { guid, indexerId }, 30_000)
    },
    search: (movieId) => api.command('MoviesSearch', { movieIds: [movieId] }),
  }
  return radarr
}

/** Radarr avec les réglages, ou une `NotConfiguredError`. */
export function getRadarr(): Radarr {
  const baseUrl = normalizeBaseUrl(getSetting('radarr_url'))
  const apiKey = getSetting('radarr_api_key')
  if (!baseUrl || !apiKey) throw new NotConfiguredError(SERVICE)
  return createRadarr({ baseUrl, apiKey })
}
