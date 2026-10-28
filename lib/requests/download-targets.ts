import type { MediaType } from '../services/tmdb/types'
import type { RequestStatus } from './status'

/** Un lot de demandes dont on veut la barre de téléchargement ; la clé est celle de la ligne. */
export interface DownloadTarget {
  key: string
  mediaType: MediaType
  tmdbId: number
  /** Vide pour un film. */
  seasons: number[]
}

/** Au plus autant de lots suivis à la fois : la liste défile sans fin, la requête reste bornée. */
export const MAX_TARGETS = 100

type Group = { ids: number[]; mediaType: MediaType; tmdbId: number; seasons: number[]; status: RequestStatus }

/** La clé d'un lot, partagée par la ligne et sa barre. */
export const groupKey = (group: Pick<Group, 'ids'>): string => group.ids.join('-')

/** Les lots qui peuvent encore télécharger. */
export function downloadTargets(groups: readonly Group[]): DownloadTarget[] {
  return groups
    .filter((group) => group.status !== 'available')
    .slice(0, MAX_TARGETS)
    .map((group) => ({ key: groupKey(group), mediaType: group.mediaType, tmdbId: group.tmdbId, seasons: group.seasons }))
}
