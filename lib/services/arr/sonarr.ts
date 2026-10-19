import 'server-only'
import { NotConfiguredError, normalizeBaseUrl, ServiceError } from '../../http'
import { getSetting } from '../../settings/store'
import { arrVersion, createArrClient, type ArrClient, type ArrConfig } from './client'
import { initialSeasons, planSeasons } from './seasons'
import type {
  ArrRelease,
  DiskSpace,
  HealthCheck,
  QualityProfile,
  QueueItem,
  RootFolder,
  SonarrCalendarEpisode,
  SonarrEpisode,
  SonarrEpisodeFile,
  SonarrSeries,
} from './types'

const SERVICE = 'Sonarr'

export type SeriesRequestOutcome =
  | { kind: 'added'; series: SonarrSeries; seasons: number[] }
  | { kind: 'seasons-added'; series: SonarrSeries; seasons: number[] }
  | { kind: 'already-requested'; series: SonarrSeries }

export interface Sonarr {
  version(): Promise<string | null>
  qualityProfiles(): Promise<QualityProfile[]>
  rootFolders(): Promise<RootFolder[]>
  diskSpace(): Promise<DiskSpace[]>
  health(): Promise<HealthCheck[]>
  /** La série si elle est dans la bibliothèque Sonarr, `null` sinon. */
  seriesByTvdbId(tvdbId: number): Promise<SonarrSeries | null>
  /** La fiche Sonarr d'une série, présente ou non dans la bibliothèque (pour connaître ses saisons). */
  lookup(tvdbId: number): Promise<SonarrSeries | null>
  /** Demande des saisons : ajoute la série si besoin, surveille les saisons demandées sans désurveiller les autres, lance leur recherche. */
  requestSeasons(tvdbId: number, seasons: readonly number[] | 'all'): Promise<SeriesRequestOutcome>
  episodes(seriesId: number): Promise<SonarrEpisode[]>
  episodeFiles(seriesId: number): Promise<SonarrEpisodeFile[]>
  setSeasonMonitored(seriesId: number, seasonNumber: number, monitored: boolean): Promise<void>
  deleteSeries(seriesId: number, deleteFiles: boolean): Promise<void>
  deleteEpisodeFile(episodeFileId: number): Promise<void>
  queue(): Promise<QueueItem[]>
  removeFromQueue(queueId: number, options: { blocklist?: boolean; removeFromClient?: boolean }): Promise<void>
  calendar(start: Date, end: Date): Promise<SonarrCalendarEpisode[]>
  releases(query: { episodeId: number } | { seriesId: number; seasonNumber: number }): Promise<ArrRelease[]>
  grabRelease(release: Pick<ArrRelease, 'guid' | 'indexerId'>): Promise<void>
}

async function languageProfileId(api: ArrClient): Promise<number | undefined> {
  try {
    const profiles = await api.getStatic<{ id: number }[]>('/languageprofile')
    return profiles[0]?.id
  } catch {
    // Sonarr v4 n'a plus de profils de langue : le champ est simplement omis.
    return undefined
  }
}

export function createSonarr(config: ArrConfig): Sonarr {
  const api = createArrClient(SERVICE, 'v3', config)

  async function searchSeasons(seriesId: number, seasons: readonly number[]): Promise<void> {
    // `SeasonSearch` par saison demandée, et non `SeriesSearch` comme MediaHub,
    // qui relançait la recherche de toute la série pour une saison ajoutée.
    for (const seasonNumber of seasons) await api.command('SeasonSearch', { seriesId, seasonNumber })
  }

  async function addSeries(tvdbId: number, requested: readonly number[] | 'all'): Promise<SeriesRequestOutcome> {
    const lookup = await sonarr.lookup(tvdbId)
    if (!lookup) throw new ServiceError(SERVICE, 'Sonarr ne trouve pas cette série (identifiant TVDB inconnu)')
    const [profiles, folders, languageId] = await Promise.all([sonarr.qualityProfiles(), sonarr.rootFolders(), languageProfileId(api)])
    const profile = profiles[0]
    const folder = folders[0]
    if (!profile || !folder) throw new ServiceError(SERVICE, 'Sonarr n\'a ni profil de qualité ni dossier racine : configure-les dans Sonarr')

    const seasons = initialSeasons(lookup.seasons ?? [], requested)
    const series = await api.post<SonarrSeries>('/series', {
      ...lookup,
      qualityProfileId: profile.id,
      languageProfileId: languageId,
      rootFolderPath: folder.path,
      monitored: true,
      seasonFolder: true,
      seasons,
      // Pas de recherche à l'ajout : elle bloquait la réponse sur les grosses instances.
      addOptions: { searchForMissingEpisodes: false },
    })
    const monitored = seasons.filter((season) => season.monitored).map((season) => season.seasonNumber)
    if (series.id) await searchSeasons(series.id, monitored)
    return { kind: 'added', series, seasons: monitored }
  }

  const sonarr: Sonarr = {
    version: () => arrVersion(api),
    qualityProfiles: () => api.getStatic('/qualityprofile'),
    rootFolders: () => api.getStatic('/rootfolder'),
    diskSpace: () => api.get('/diskspace'),
    health: () => api.get('/health'),
    async seriesByTvdbId(tvdbId) {
      // `/series?tvdbId=` ne lit que la bibliothèque, sans appel au serveur de métadonnées.
      const series = await api.get<SonarrSeries[]>('/series', { tvdbId })
      return series[0] ?? null
    },
    async lookup(tvdbId) {
      const results = await api.get<SonarrSeries[]>('/series/lookup', { term: `tvdb:${tvdbId}` })
      return results[0] ?? null
    },
    async requestSeasons(tvdbId, requested) {
      const existing = await sonarr.seriesByTvdbId(tvdbId)
      if (!existing?.id) return addSeries(tvdbId, requested)

      const { seasons, newlyMonitored } = planSeasons(existing.seasons, requested)
      if (newlyMonitored.length === 0 && existing.monitored) return { kind: 'already-requested', series: existing }
      const series = await api.put<SonarrSeries>(`/series/${existing.id}`, { ...existing, monitored: true, seasons })
      await searchSeasons(existing.id, newlyMonitored)
      return { kind: 'seasons-added', series, seasons: newlyMonitored }
    },
    episodes: (seriesId) => api.get('/episode', { seriesId }),
    episodeFiles: (seriesId) => api.get('/episodefile', { seriesId }),
    async setSeasonMonitored(seriesId, seasonNumber, monitored) {
      const series = await api.get<SonarrSeries>(`/series/${seriesId}`)
      const seasons = series.seasons.map((season) => (season.seasonNumber === seasonNumber ? { ...season, monitored } : season))
      await api.put(`/series/${seriesId}`, { ...series, seasons })
    },
    async deleteSeries(seriesId, deleteFiles) {
      await api.delete(`/series/${seriesId}`, { deleteFiles, addImportListExclusion: false })
    },
    async deleteEpisodeFile(episodeFileId) {
      await api.delete(`/episodefile/${episodeFileId}`)
    },
    async queue() {
      const page = await api.get<{ records?: QueueItem[] } | QueueItem[]>('/queue', {
        pageSize: 1000,
        includeSeries: true,
        includeEpisode: true,
        includeUnknownSeriesItems: false,
      })
      return Array.isArray(page) ? page : (page.records ?? [])
    },
    async removeFromQueue(queueId, { blocklist = false, removeFromClient = true }) {
      await api.delete(`/queue/${queueId}`, { removeFromClient, blocklist })
    },
    calendar: (start, end) =>
      api.get('/calendar', { start: start.toISOString(), end: end.toISOString(), unmonitored: false, includeSeries: true }),
    releases: (query) => api.get('/release', 'episodeId' in query ? { episodeId: query.episodeId } : query),
    async grabRelease({ guid, indexerId }) {
      await api.post('/release', { guid, indexerId }, 30_000)
    },
  }
  return sonarr
}

/** Sonarr avec les réglages, ou une `NotConfiguredError`. */
export function getSonarr(): Sonarr {
  const baseUrl = normalizeBaseUrl(getSetting('sonarr_url'))
  const apiKey = getSetting('sonarr_api_key')
  if (!baseUrl || !apiKey) throw new NotConfiguredError(SERVICE)
  return createSonarr({ baseUrl, apiKey })
}
