import 'server-only'
import type { QueueItem } from '../services/arr/types'
import { qbitLive } from '../services/qbittorrent/live'
import type { Torrent } from '../services/qbittorrent/types'
import type { MediaType } from '../services/tmdb/types'
import { sorraaDownloadsFor } from '../integration/sorraa-downloads'
import { findSeries, getLibrary, type LibraryIndex } from './library'

/**
 * La progression d'un média en téléchargement, sur sa fiche : la file
 * Radarr/Sonarr dit **quoi** se télécharge, qBittorrent dit **où on en est**
 * (le hash du torrent est le `downloadId` de la file). Sans qBit, on retombe
 * sur les tailles de la file, rafraîchies moins souvent.
 */
export interface DownloadProgress {
  /** Le nom de la release. */
  title: string
  seasonNumber: number | null
  /** 0 à 100. */
  progress: number
  size: number
  sizeLeft: number
  /** Octets par seconde, si qBit est branché. */
  speed: number | null
  /** Secondes restantes, si connues. */
  eta: number | null
  /** Le torrent est en pause ou en erreur (pour le dire, plutôt qu'une barre figée). */
  stalled: boolean
}

// qBit renvoie 8 640 000 s (100 jours) pour « inconnu ».
const UNKNOWN_ETA = 8_640_000
const STALLED_STATES = new Set(['pausedDL', 'stoppedDL', 'stalledDL', 'error', 'missingFiles'])

function progressOf(item: QueueItem, torrent: Torrent | undefined, seasonNumber: number | null): DownloadProgress {
  if (torrent) {
    return {
      title: torrent.name || item.title,
      seasonNumber,
      progress: Math.min(100, Math.round(torrent.progress * 1000) / 10),
      size: torrent.size,
      sizeLeft: Math.max(0, torrent.size - torrent.downloaded),
      speed: torrent.dlspeed,
      eta: torrent.eta > 0 && torrent.eta < UNKNOWN_ETA ? torrent.eta : null,
      stalled: STALLED_STATES.has(torrent.state),
    }
  }
  const done = item.size > 0 ? ((item.size - item.sizeleft) / item.size) * 100 : 0
  return { title: item.title, seasonNumber, progress: Math.round(done * 10) / 10, size: item.size, sizeLeft: item.sizeleft, speed: null, eta: null, stalled: false }
}

/** Pure : les téléchargements d'un média d'après l'index et les torrents qBit (clés en minuscules). */
export function downloadsIn(
  index: LibraryIndex,
  torrents: Readonly<Record<string, Torrent>>,
  mediaType: MediaType,
  tmdbId: number,
  tvdbId?: number | null,
): DownloadProgress[] {
  const torrentOf = (item: QueueItem) => (item.downloadId ? torrents[item.downloadId.toLowerCase()] : undefined)

  if (mediaType === 'movie') {
    const movieId = index.movies.get(tmdbId)?.id
    if (!movieId) return []
    return index.movieQueue.filter((item) => item.movieId === movieId).map((item) => progressOf(item, torrentOf(item), null))
  }

  const seriesId = findSeries(index, tmdbId, tvdbId)?.id
  if (!seriesId) return []
  // Un pack de saison apparaît une fois par épisode dans la file Sonarr : une seule ligne par téléchargement.
  const seen = new Set<string>()
  const result: DownloadProgress[] = []
  for (const item of index.seriesQueue) {
    if (item.seriesId !== seriesId) continue
    const key = item.downloadId ?? `queue-${item.id}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(progressOf(item, torrentOf(item), item.episode?.seasonNumber ?? item.seasonNumber ?? null))
  }
  return result.sort((a, b) => (a.seasonNumber ?? 0) - (b.seasonNumber ?? 0))
}

export async function mediaDownloads(mediaType: MediaType, tmdbId: number, tvdbId?: number | null): Promise<DownloadProgress[]> {
  // sorraa, quand il rapporte, dit lui-même où en sont ses téléchargements.
  const reported = sorraaDownloadsFor(mediaType, tmdbId)
  if (reported) return reported
  const index = await getLibrary()
  const hasQueue = mediaType === 'movie' ? index.movieQueue.length > 0 : index.seriesQueue.length > 0
  if (!hasQueue) return []
  // `snapshot` ne rappelle qBit que si son état a plus d'un intervalle de rafraîchissement.
  const torrents = (await qbitLive().snapshot()).torrents
  return downloadsIn(index, torrents, mediaType, tmdbId, tvdbId)
}
