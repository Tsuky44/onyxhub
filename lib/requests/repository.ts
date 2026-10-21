import 'server-only'
import { and, desc, eq, gt, inArray, ne, or, sql, type SQL } from 'drizzle-orm'
import { getDb } from '../db'
import { mediaRequests, type MediaRequestRow } from '../db/schema'
import type { MediaType } from '../services/tmdb/types'
import type { RequestStatus } from './status'

/** L'accès à la table des demandes. Aucune règle métier ici : seulement lire et écrire. */

export type NewRequest = Omit<MediaRequestRow, 'id'>

export function requestsForMedia(mediaType: MediaType, tmdbId: number): MediaRequestRow[] {
  return getDb()
    .select()
    .from(mediaRequests)
    .where(and(eq(mediaRequests.mediaType, mediaType), eq(mediaRequests.tmdbId, tmdbId)))
    .orderBy(mediaRequests.seasonNumber)
    .all()
}

export function requestsByIds(ids: readonly number[]): MediaRequestRow[] {
  if (ids.length === 0) return []
  return getDb().select().from(mediaRequests).where(inArray(mediaRequests.id, [...ids])).all()
}

export function requestsByTvdb(tvdbId: number): MediaRequestRow[] {
  return getDb().select().from(mediaRequests).where(eq(mediaRequests.tvdbId, tvdbId)).all()
}

/** Les demandes qui peuvent encore avancer (tout sauf « disponible »). */
export function openRequests(): MediaRequestRow[] {
  return getDb().select().from(mediaRequests).where(ne(mediaRequests.status, 'available')).all()
}

/**
 * Ajoute les lignes qui n'existent pas encore pour ce média (un film, ou une
 * saison) et renvoie celles qui ont été créées. La vérification et l'écriture
 * sont dans la même transaction : deux demandes simultanées de la même saison
 * n'en créent qu'une.
 */
export function insertMissing(rows: readonly NewRequest[]): MediaRequestRow[] {
  if (rows.length === 0) return []
  const db = getDb()
  return db.transaction((tx) => {
    const first = rows[0]!
    const existing = tx
      .select({ seasonNumber: mediaRequests.seasonNumber })
      .from(mediaRequests)
      .where(and(eq(mediaRequests.mediaType, first.mediaType), eq(mediaRequests.tmdbId, first.tmdbId)))
      .all()
    const taken = new Set(existing.map((row) => row.seasonNumber))
    const fresh = rows.filter((row) => !taken.has(row.seasonNumber))
    if (fresh.length === 0) return []
    return tx.insert(mediaRequests).values(fresh).returning().all()
  })
}

export function updateStatuses(changes: ReadonlyMap<number, RequestStatus>): void {
  if (changes.size === 0) return
  const now = new Date()
  getDb().transaction((tx) => {
    for (const [id, status] of changes) {
      tx.update(mediaRequests).set({ status, updatedAt: now }).where(eq(mediaRequests.id, id)).run()
    }
  })
}

export function setMediaStatus(mediaType: MediaType, tmdbId: number, status: RequestStatus): void {
  getDb()
    .update(mediaRequests)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(mediaRequests.mediaType, mediaType), eq(mediaRequests.tmdbId, tmdbId)))
    .run()
}

export function deleteRequestRows(ids: readonly number[]): void {
  if (ids.length === 0) return
  getDb().delete(mediaRequests).where(inArray(mediaRequests.id, [...ids])).run()
}

export function deleteMediaRows(mediaType: MediaType, tmdbId: number): void {
  getDb()
    .delete(mediaRequests)
    .where(and(eq(mediaRequests.mediaType, mediaType), eq(mediaRequests.tmdbId, tmdbId)))
    .run()
}

/** Les dernières demandes d'un compte, plus récentes d'abord (recommandations, accueil). */
export function recentRequestsOf(requester: string, limit: number): MediaRequestRow[] {
  return getDb()
    .select()
    .from(mediaRequests)
    .where(eq(mediaRequests.requester, requester))
    .orderBy(desc(mediaRequests.requestedAt))
    .limit(limit)
    .all()
}

/**
 * Les `limit` dernières lignes créées après `afterId`, plus récentes d'abord.
 * L'identifiant plutôt que `requestedAt` : la date est prise avant l'appel à
 * Radarr ou Sonarr, la ligne écrite après, si bien qu'une demande lente
 * arriverait avec une date déjà dépassée par le curseur.
 */
export function requestsAfter(afterId: number, limit: number): MediaRequestRow[] {
  return getDb().select().from(mediaRequests).where(gt(mediaRequests.id, afterId)).orderBy(desc(mediaRequests.id)).limit(limit).all()
}

/** L'identifiant de la dernière ligne créée, 0 sans demande. */
export function lastRequestId(): number {
  const row = getDb().select({ id: sql<number | null>`max(${mediaRequests.id})` }).from(mediaRequests).get()
  return row?.id ?? 0
}

/** Les identifiants TVDB connus par série, pour retrouver une série dans Sonarr v3 sans appeler TMDB. */
export function knownTvdbIds(tmdbIds: readonly number[]): Map<number, number> {
  if (tmdbIds.length === 0) return new Map()
  const rows = getDb()
    .selectDistinct({ tmdbId: mediaRequests.tmdbId, tvdbId: mediaRequests.tvdbId })
    .from(mediaRequests)
    .where(and(eq(mediaRequests.mediaType, 'tv'), inArray(mediaRequests.tmdbId, [...tmdbIds])))
    .all()
  return new Map(rows.flatMap((row) => (row.tvdbId ? [[row.tmdbId, row.tvdbId] as const] : [])))
}

export interface RequestListFilters {
  mediaType?: MediaType
  status?: RequestStatus
  /** `mine` / `others` : par rapport à `viewer`. */
  owner?: 'mine' | 'others'
  viewer: string
  query?: string
}

function filterClause(filters: RequestListFilters): SQL | undefined {
  const clauses: (SQL | undefined)[] = []
  if (filters.mediaType) clauses.push(eq(mediaRequests.mediaType, filters.mediaType))
  if (filters.status) clauses.push(eq(mediaRequests.status, filters.status))
  if (filters.owner === 'mine') clauses.push(eq(mediaRequests.requester, filters.viewer))
  if (filters.owner === 'others') clauses.push(ne(mediaRequests.requester, filters.viewer))
  const query = filters.query?.trim()
  if (query) {
    // Comme MediaHub : la recherche porte sur le titre et sur le demandeur.
    const pattern = `%${query.replace(/[\\%_]/g, (char) => `\\${char}`)}%`
    clauses.push(or(sql`${mediaRequests.title} like ${pattern} escape '\\'`, sql`${mediaRequests.requester} like ${pattern} escape '\\'`))
  }
  return and(...clauses)
}

/**
 * Une page de la liste des demandes, **par lot** : les saisons demandées
 * ensemble restent sur une ligne, et la pagination ne coupe jamais un lot.
 */
export function listRequestBatches(filters: RequestListFilters, offset: number, limit: number): { batches: MediaRequestRow[][]; hasMore: boolean } {
  const db = getDb()
  const where = filterClause(filters)
  const latest = sql<number>`max(${mediaRequests.requestedAt})`
  const page = db
    .select({ batchId: mediaRequests.batchId, latest })
    .from(mediaRequests)
    .where(where)
    .groupBy(mediaRequests.batchId)
    .orderBy(desc(latest), desc(mediaRequests.batchId))
    .limit(limit + 1)
    .offset(offset)
    .all()
  const batchIds = page.slice(0, limit).map((row) => row.batchId)
  if (batchIds.length === 0) return { batches: [], hasMore: false }

  const rows = db
    .select()
    .from(mediaRequests)
    .where(and(where, inArray(mediaRequests.batchId, batchIds)))
    .orderBy(mediaRequests.seasonNumber)
    .all()
  const byBatch = new Map<string, MediaRequestRow[]>(batchIds.map((id) => [id, []]))
  for (const row of rows) byBatch.get(row.batchId)?.push(row)
  return { batches: [...byBatch.values()].filter((batch) => batch.length > 0), hasMore: page.length > limit }
}

export function countByStatus(): Record<RequestStatus, number> {
  const rows = getDb()
    .select({ status: mediaRequests.status, count: sql<number>`count(*)` })
    .from(mediaRequests)
    .groupBy(mediaRequests.status)
    .all()
  const counts: Record<RequestStatus, number> = { pending: 0, approved: 0, processing: 0, partial: 0, available: 0 }
  for (const row of rows) counts[row.status] = row.count
  return counts
}
