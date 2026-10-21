import 'server-only'
import type { MediaRequestRow } from '../db/schema'
import type { MediaType } from '../services/tmdb/types'
import type { Requester } from './create'
import { lastRequestId, requestsAfter } from './repository'

/**
 * Le flux des nouvelles demandes, que l'app Onyx d'un administrateur relève
 * en tâche de fond pour en faire une notification (ADR-0013). Il n'y a pas de
 * push : l'app revient avec le curseur de son dernier passage.
 */

/** Un lot de demandes : un film, ou les saisons d'une série demandées d'un même geste. */
export interface FeedEntry {
  /** La première ligne du lot : stable, l'app en fait l'identifiant de la notification. */
  id: number
  mediaType: MediaType
  tmdbId: number
  title: string
  posterPath: string | null
  /** Vide pour un film. */
  seasons: number[]
  requester: string
  requestedAt: string
}

export interface RequestFeed {
  /** À renvoyer au passage suivant : tout ce qui a été créé jusque-là est vu. */
  cursor: number
  /** Les plus anciennes d'abord, dans l'ordre où les notifications doivent s'empiler. */
  requests: FeedEntry[]
}

/** Au-delà, les plus anciennes sont tues : vingt notifications d'un coup en disent déjà assez. */
export const FEED_LIMIT = 20

/** Une série de 30 saisons fait 30 lignes : de quoi remplir les lots de la page sans en couper un. */
const ROWS_PER_FEED = FEED_LIMIT * 40

function isOwn(row: MediaRequestRow, caller: Requester): boolean {
  if (caller.id !== null && row.requesterId !== null) return row.requesterId === caller.id
  return row.requester === caller.name
}

/**
 * Les demandes créées après `after`, sauf celles de l'appelant : un
 * administrateur n'a pas besoin qu'on lui annonce ce qu'il vient de demander.
 *
 * Sans `after` (premier passage de l'appareil), rien n'est rendu et le
 * curseur est posé au bout : activer les notifications n'annonce pas tout
 * l'historique.
 */
export function requestFeed(after: number | null, caller: Requester): RequestFeed {
  if (after === null) return { cursor: lastRequestId(), requests: [] }

  const rows = requestsAfter(after, ROWS_PER_FEED)
  const cursor = rows.reduce((max, row) => Math.max(max, row.id), after)
  const batches = new Map<string, MediaRequestRow[]>()
  for (const row of rows) {
    if (isOwn(row, caller)) continue
    const batch = batches.get(row.batchId)
    if (batch) batch.push(row)
    else batches.set(row.batchId, [row])
  }

  const requests = [...batches.values()]
    .map((batch): FeedEntry => {
      const first = batch.reduce((a, b) => (a.id < b.id ? a : b))
      return {
        id: first.id,
        mediaType: first.mediaType,
        tmdbId: first.tmdbId,
        title: first.title,
        posterPath: first.posterPath,
        seasons: batch.flatMap((row) => (row.seasonNumber === null ? [] : [row.seasonNumber])).sort((a, b) => a - b),
        requester: first.requester,
        requestedAt: first.requestedAt.toISOString(),
      }
    })
    .sort((a, b) => a.id - b.id)
    .slice(-FEED_LIMIT)
  return { cursor, requests }
}
