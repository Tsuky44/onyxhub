import 'server-only'
import { and, desc, eq } from 'drizzle-orm'
import { readSession } from '../auth/session'
import type { Viewer } from '../auth/viewer'
import { eachLimited } from '../concurrency'
import { getDb } from '../db'
import { watchLater } from '../db/schema'
import { errorMessage } from '../http'
import { OnyxCapability, onyxSupports } from '../services/onyx/capabilities'
import { getOnyxWatchLater, type OnyxListItem } from '../services/onyx/lists'
import type { MediaType } from '../services/tmdb/types'
import { TtlCache } from '../ttl-cache'

/**
 * « À regarder plus tard », par compte Onyx (ADR-0010).
 *
 * Onyx tient cette liste depuis son ADR-0070 : OnyxHub lit et écrit la sienne,
 * pour que l'app et le web montrent la même. La table locale ne sert plus que
 * face à un Onyx qui n'a pas encore les listes ; ce qu'elle contient part dans
 * Onyx la première fois que le compte passe par ici avec un Onyx qui les a.
 */
export interface WatchLaterItem {
  mediaType: MediaType
  tmdbId: number
  title: string
  posterPath: string | null
}

// 30 s : la fiche et la page « Plus tard » se relisent sans rappeler Onyx, et
// un ajout fait dans l'app apparaît vite. Chaque écriture d'ici vide l'entrée.
const onyxItems = new TtlCache<OnyxListItem[]>(30_000, 200)
const imported = new Set<number>()

async function onyxToken(): Promise<string | null> {
  if (!(await onyxSupports(OnyxCapability.watchLists))) return null
  return (await readSession())?.token ?? null
}

function localItems(userId: number): WatchLaterItem[] {
  return getDb()
    .select({ mediaType: watchLater.mediaType, tmdbId: watchLater.tmdbId, title: watchLater.title, posterPath: watchLater.posterPath })
    .from(watchLater)
    .where(eq(watchLater.userId, userId))
    .orderBy(desc(watchLater.createdAt))
    .all()
}

function setLocal(userId: number, item: WatchLaterItem, wanted: boolean): void {
  const db = getDb()
  if (wanted) {
    db.insert(watchLater).values({ ...item, userId, createdAt: new Date() }).onConflictDoNothing().run()
  } else {
    db.delete(watchLater)
      .where(and(eq(watchLater.userId, userId), eq(watchLater.mediaType, item.mediaType), eq(watchLater.tmdbId, item.tmdbId)))
      .run()
  }
}

/**
 * Verse dans Onyx ce que le compte avait rangé dans OnyxHub avant que la liste
 * passe chez Onyx. Une ligne n'est effacée qu'une fois Onyx l'a acceptée : un
 * échec la laisse pour la prochaine fois.
 */
async function importLocal(userId: number, token: string): Promise<void> {
  if (imported.has(userId)) return
  const pending = localItems(userId)
  if (pending.length > 0) {
    const onyx = getOnyxWatchLater(token)
    await eachLimited(pending, 2, async (item) => {
      try {
        await onyx.add(item)
        setLocal(userId, item, false)
      } catch (error) {
        console.warn(`[plus tard] ${item.mediaType}/${item.tmdbId} non versé dans Onyx : ${errorMessage(error)}`)
      }
    })
  }
  if (localItems(userId).length === 0) imported.add(userId)
}

async function loadOnyx(userId: number, token: string): Promise<OnyxListItem[]> {
  return onyxItems.load(String(userId), async () => {
    await importLocal(userId, token)
    return getOnyxWatchLater(token).items()
  })
}

export async function listWatchLater(viewer: Viewer): Promise<WatchLaterItem[]> {
  const token = await onyxToken()
  if (!token) return localItems(viewer.id)
  return (await loadOnyx(viewer.id, token)).map(({ mediaType, tmdbId, title, posterPath }) => ({ mediaType, tmdbId, title, posterPath }))
}

export async function isInWatchLater(viewer: Viewer, mediaType: MediaType, tmdbId: number): Promise<boolean> {
  const items = await listWatchLater(viewer)
  return items.some((item) => item.mediaType === mediaType && item.tmdbId === tmdbId)
}

/** Ajoute ou retire ; renvoie l'état final (`true` : dans la liste). */
export async function setWatchLater(viewer: Viewer, item: WatchLaterItem, wanted: boolean): Promise<boolean> {
  const token = await onyxToken()
  if (!token) {
    setLocal(viewer.id, item, wanted)
    return wanted
  }
  const onyx = getOnyxWatchLater(token)
  try {
    if (wanted) {
      await onyx.add(item)
    } else {
      const existing = (await loadOnyx(viewer.id, token)).find((entry) => entry.mediaType === item.mediaType && entry.tmdbId === item.tmdbId)
      if (existing) await onyx.remove(existing.id)
    }
  } finally {
    onyxItems.delete(String(viewer.id))
  }
  return wanted
}
