import 'server-only'
import { errorMessage } from '../http'
import { downloadTargets, groupKey } from '../requests/download-targets'
import { downloadsOf } from '../requests/group-downloads'
import { loadRequestPage, type RequestGroup } from '../requests/list'
import { refreshStatuses } from '../requests/sync'
import type { RequestListFilters } from '../requests/repository'
import { countByStatus } from '../requests/repository'
import type { RequestStatus } from '../requests/status'

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
  // Même source que la fiche et la liste : le rapport de sorraa d'abord, la file Radarr/Sonarr sinon.
  const { downloads } = await downloadsOf(downloadTargets(groups.filter((group) => group.status === 'processing')))
  return groups.map((group) => {
    const download = downloads[groupKey(group)]
    return { ...group, progress: download ? Math.round(download.progress * 10) / 10 : null }
  })
}

export function requestCounts(): Record<RequestStatus, number> {
  return countByStatus()
}
