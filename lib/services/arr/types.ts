/** Les formes Radarr/Sonarr (API v3) lues par OnyxHub. Seuls les champs utilisés sont typés. */

export interface ArrImage {
  coverType: string
  url?: string
  remoteUrl?: string
}

export interface QualityProfile {
  id: number
  name: string
}

export interface RootFolder {
  id: number
  path: string
  freeSpace?: number
  accessible?: boolean
}

export interface DiskSpace {
  path: string
  label?: string
  freeSpace: number
  totalSpace: number
}

export interface HealthCheck {
  source: string
  type: 'ok' | 'notice' | 'warning' | 'error'
  message: string
  wikiUrl?: string
}

export interface RadarrMovie {
  id?: number
  tmdbId: number
  imdbId?: string
  title: string
  /** Le segment d'URL de la fiche dans l'interface Radarr (`/movie/<slug>`). */
  titleSlug?: string
  year: number
  overview?: string
  monitored: boolean
  hasFile: boolean
  isAvailable?: boolean
  status?: string
  sizeOnDisk?: number
  qualityProfileId?: number
  rootFolderPath?: string
  path?: string
  added?: string
  inCinemas?: string
  digitalRelease?: string
  physicalRelease?: string
  images?: ArrImage[]
  movieFile?: { id: number; relativePath?: string; size?: number; quality?: { quality?: { name?: string } } }
}

export interface SonarrSeasonStatistics {
  episodeFileCount: number
  episodeCount: number
  totalEpisodeCount: number
  sizeOnDisk?: number
  percentOfEpisodes?: number
}

export interface SonarrSeason {
  seasonNumber: number
  monitored: boolean
  statistics?: SonarrSeasonStatistics
}

export interface SonarrSeries {
  id?: number
  tvdbId: number
  tmdbId?: number
  imdbId?: string
  title: string
  /** Le segment d'URL de la fiche dans l'interface Sonarr (`/series/<slug>`). */
  titleSlug?: string
  year?: number
  overview?: string
  monitored: boolean
  status?: string
  network?: string
  seasons: SonarrSeason[]
  images?: ArrImage[]
  qualityProfileId?: number
  languageProfileId?: number
  rootFolderPath?: string
  path?: string
  seasonFolder?: boolean
  seriesType?: string
  statistics?: SonarrSeasonStatistics & { seasonCount?: number }
}

export interface SonarrEpisode {
  id: number
  seriesId: number
  seasonNumber: number
  episodeNumber: number
  title?: string
  overview?: string
  airDate?: string
  airDateUtc?: string
  hasFile: boolean
  monitored: boolean
  episodeFileId?: number
  series?: SonarrSeries
}

export interface SonarrEpisodeFile {
  id: number
  seasonNumber: number
  relativePath?: string
  size?: number
  quality?: { quality?: { name?: string } }
}

/** Un élément de la file de téléchargement d'un *arr. `downloadId` est le hash du torrent côté qBittorrent. */
export interface QueueItem {
  id: number
  title: string
  status: string
  trackedDownloadStatus?: string
  trackedDownloadState?: string
  statusMessages?: { title?: string; messages?: string[] }[]
  errorMessage?: string
  size: number
  sizeleft: number
  timeleft?: string
  estimatedCompletionTime?: string
  downloadId?: string
  downloadClient?: string
  protocol?: string
  movieId?: number
  movie?: RadarrMovie
  seriesId?: number
  episodeId?: number
  seasonNumber?: number
  series?: SonarrSeries
  episode?: SonarrEpisode
}

/** Une release trouvée par la recherche interactive d'un *arr. */
export interface ArrRelease {
  guid: string
  indexerId: number
  indexer?: string
  title: string
  size: number
  seeders?: number
  leechers?: number
  protocol?: string
  age?: number
  ageHours?: number
  publishDate?: string
  quality?: { quality?: { name?: string; resolution?: number } }
  languages?: { id: number; name: string }[]
  rejected?: boolean
  rejections?: string[]
  downloadAllowed?: boolean
  infoUrl?: string
  customFormatScore?: number
}

export interface RadarrCalendarMovie extends RadarrMovie {
  id: number
}

export interface SonarrCalendarEpisode extends SonarrEpisode {
  series: SonarrSeries
}
