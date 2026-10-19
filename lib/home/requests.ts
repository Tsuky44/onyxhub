import 'server-only'
import { downloadsIn } from '../requests/downloads'
import { getLibrary } from '../requests/library'
import { errorMessage } from '../http'
import { loadRequestPage, type RequestGroup } from '../requests/list'
import { refreshStatuses } from '../requests/sync'
import type { RequestListFilters } from '../requests/repository'
import { countByStatus } from '../requests/repository'
import type { RequestStatus } from '../requests/status'
import { qbittorrentConfig } from '../services/qbittorrent/client'
import { qbitLive } from '../services/qbittorrent/live'

/**
 * Les demandes de l'accueil : les miennes (ou celles de tout le monde pour
 * l'admin), avec la progression du téléchargement quand il y en a un.
 */
export interface HomeRequest extends RequestGroup {
  /** 0 à 100 pendant un téléchargement, sinon `null`. */
  progress: number | null
}

export async function homeRequests(filters: RequestListFilters, limit: number): Promise<HomeRequest[]> {
  // Comme la liste : les statuts rattrapent Radarr/Sonarr (index partagé, aucun appel en plus la plupart du temps).
  await refreshStatuses().catch((error: unknown) => console.warn(`[accueil] statuts : ${errorMessage(error)}`))
  const groups = loadRequestPage(filters, 0).groups.slice(0, limit)
  const downloading = groups.filter((group) => group.status === 'processing')
  if (downloading.length === 0) return groups.map((group) => ({ ...group, progress: null }))

  const index = await getLibrary()
  const torrents = qbittorrentConfig() ? (await qbitLive().snapshot()).torrents : {}
  return groups.map((group) => {
    if (group.status !== 'processing') return { ...group, progress: null }
    const items = downloadsIn(index, torrents, group.mediaType, group.tmdbId)
    // Pour un lot de saisons, seules les saisons du lot comptent.
    const relevant = group.seasons.length > 0 ? items.filter((item) => item.seasonNumber === null || group.seasons.includes(item.seasonNumber)) : items
    if (relevant.length === 0) return { ...group, progress: null }
    const size = relevant.reduce((total, item) => total + item.size, 0)
    const left = relevant.reduce((total, item) => total + item.sizeLeft, 0)
    return { ...group, progress: size > 0 ? Math.round(((size - left) / size) * 1000) / 10 : 0 }
  })
}

export function requestCounts(): Record<RequestStatus, number> {
  return countByStatus()
}
