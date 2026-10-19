import 'server-only'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { getDb } from '../db'
import { watchLater } from '../db/schema'
import type { MediaType } from '../services/tmdb/types'

/** « À regarder plus tard », par compte Onyx (identifiant numérique d'Onyx). */
export interface WatchLaterItem {
  mediaType: MediaType
  tmdbId: number
  title: string
  posterPath: string | null
}

export function listWatchLater(userId: number): WatchLaterItem[] {
  return getDb()
    .select({ mediaType: watchLater.mediaType, tmdbId: watchLater.tmdbId, title: watchLater.title, posterPath: watchLater.posterPath })
    .from(watchLater)
    .where(eq(watchLater.userId, userId))
    .orderBy(desc(watchLater.createdAt))
    .all()
}

export function isInWatchLater(userId: number, mediaType: MediaType, tmdbId: number): boolean {
  return Boolean(
    getDb()
      .select({ id: watchLater.id })
      .from(watchLater)
      .where(and(eq(watchLater.userId, userId), eq(watchLater.mediaType, mediaType), eq(watchLater.tmdbId, tmdbId)))
      .get(),
  )
}

/** Les clés `type:id` d'une page de cartes qui sont dans la liste du compte. */
export function watchLaterKeys(userId: number, tmdbIds: readonly number[]): Set<string> {
  if (tmdbIds.length === 0) return new Set()
  const rows = getDb()
    .select({ mediaType: watchLater.mediaType, tmdbId: watchLater.tmdbId })
    .from(watchLater)
    .where(and(eq(watchLater.userId, userId), inArray(watchLater.tmdbId, [...tmdbIds])))
    .all()
  return new Set(rows.map((row) => `${row.mediaType}:${row.tmdbId}`))
}

/** Ajoute ou retire ; renvoie l'état final (`true` : dans la liste). */
export function setWatchLater(userId: number, item: WatchLaterItem, wanted: boolean): boolean {
  const db = getDb()
  if (wanted) {
    db.insert(watchLater).values({ ...item, userId, createdAt: new Date() }).onConflictDoNothing().run()
  } else {
    db.delete(watchLater)
      .where(and(eq(watchLater.userId, userId), eq(watchLater.mediaType, item.mediaType), eq(watchLater.tmdbId, item.tmdbId)))
      .run()
  }
  return wanted
}
