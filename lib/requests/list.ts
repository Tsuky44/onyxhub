import 'server-only'
import type { MediaType } from '../services/tmdb/types'
import { listRequestBatches, type RequestListFilters } from './repository'
import { furthestStatus, isRequestStatus, type RequestStatus } from './status'

/**
 * La liste des demandes : une ligne par lot (un film, ou les saisons
 * demandées d'un même geste), avec les filtres de MediaHub (type, demandeur,
 * recherche) plus le statut. Tout le monde voit toutes les demandes, comme
 * dans MediaHub ; seul l'admin supprime.
 */
export const PAGE_SIZE = 30

export interface RequestGroup {
  /** Toutes les lignes du lot (suppression groupée). */
  ids: number[]
  mediaType: MediaType
  tmdbId: number
  title: string
  posterPath: string | null
  /** Vide pour un film. */
  seasons: number[]
  status: RequestStatus
  requester: string
  /** ISO 8601 : le composant client reçoit une chaîne. */
  requestedAt: string
}

export interface RequestListPage {
  groups: RequestGroup[]
  nextOffset: number
  hasMore: boolean
}

type Params = { get(name: string): string | null }

export function parseListFilters(params: Params, viewer: string): RequestListFilters {
  const type = params.get('type')
  const owner = params.get('demandeur')
  const status = params.get('statut')
  return {
    viewer,
    mediaType: type === 'film' ? 'movie' : type === 'serie' ? 'tv' : undefined,
    owner: owner === 'moi' ? 'mine' : owner === 'autres' ? 'others' : undefined,
    status: isRequestStatus(status) ? status : undefined,
    query: (params.get('q') ?? '').trim().slice(0, 100) || undefined,
  }
}

export function loadRequestPage(filters: RequestListFilters, offset: number): RequestListPage {
  const { batches, hasMore } = listRequestBatches(filters, offset, PAGE_SIZE)
  const groups = batches.map((rows): RequestGroup => {
    const first = rows[0]!
    return {
      ids: rows.map((row) => row.id),
      mediaType: first.mediaType,
      tmdbId: first.tmdbId,
      title: first.title,
      posterPath: first.posterPath,
      seasons: rows.flatMap((row) => (row.seasonNumber === null ? [] : [row.seasonNumber])),
      status: furthestStatus(rows.map((row) => row.status)),
      requester: first.requester,
      requestedAt: new Date(Math.max(...rows.map((row) => row.requestedAt.getTime()))).toISOString(),
    }
  })
  return { groups, nextOffset: offset + PAGE_SIZE, hasMore }
}
