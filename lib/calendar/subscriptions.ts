import 'server-only'
import { and, desc, eq } from 'drizzle-orm'
import { eachLimited } from '../concurrency'
import { getDb } from '../db'
import { calendarSubscriptions } from '../db/schema'
import { errorMessage, NotConfiguredError } from '../http'
import { getTmdb } from '../services/tmdb/client'
import type { MediaType } from '../services/tmdb/types'
import type { Release } from './releases'
import { seasonsOverlapping, tmdbEpisodeReleases, tmdbMovieReleases } from './tmdb-releases'

/** Les abonnements au calendrier d'un compte Onyx (identifiant numérique d'Onyx). */
export interface Subscription {
  mediaType: MediaType
  tmdbId: number
  title: string
  posterPath: string | null
}

export function listSubscriptions(userId: number): Subscription[] {
  return getDb()
    .select({
      mediaType: calendarSubscriptions.mediaType,
      tmdbId: calendarSubscriptions.tmdbId,
      title: calendarSubscriptions.title,
      posterPath: calendarSubscriptions.posterPath,
    })
    .from(calendarSubscriptions)
    .where(eq(calendarSubscriptions.userId, userId))
    .orderBy(desc(calendarSubscriptions.createdAt))
    .all()
}

export function isSubscribed(userId: number, mediaType: MediaType, tmdbId: number): boolean {
  return Boolean(
    getDb()
      .select({ id: calendarSubscriptions.id })
      .from(calendarSubscriptions)
      .where(and(eq(calendarSubscriptions.userId, userId), eq(calendarSubscriptions.mediaType, mediaType), eq(calendarSubscriptions.tmdbId, tmdbId)))
      .get(),
  )
}

/** Abonne ou désabonne ; renvoie l'état final (`true` : abonné). */
export function setSubscription(userId: number, item: Subscription, wanted: boolean): boolean {
  const db = getDb()
  if (wanted) {
    db.insert(calendarSubscriptions).values({ ...item, userId, createdAt: new Date() }).onConflictDoNothing().run()
  } else {
    db.delete(calendarSubscriptions)
      .where(and(eq(calendarSubscriptions.userId, userId), eq(calendarSubscriptions.mediaType, item.mediaType), eq(calendarSubscriptions.tmdbId, item.tmdbId)))
      .run()
  }
  return wanted
}

async function releasesOf(subscription: Subscription, from: string, to: string): Promise<Release[]> {
  const tmdb = getTmdb()
  const media = { tmdbId: subscription.tmdbId, title: subscription.title, posterPath: subscription.posterPath }
  if (subscription.mediaType === 'movie') {
    const [details, dates] = await Promise.all([tmdb.details('movie', subscription.tmdbId), tmdb.releaseDates(subscription.tmdbId)])
    return tmdbMovieReleases({ ...media, posterPath: details.poster_path ?? media.posterPath }, dates, details.release_date, from, to)
  }
  const show = await tmdb.details('tv', subscription.tmdbId)
  const seasons = await Promise.all(seasonsOverlapping(show.seasons ?? [], from, to).map((number) => tmdb.season(subscription.tmdbId, number)))
  return seasons.flatMap((season) => tmdbEpisodeReleases({ ...media, posterPath: show.poster_path ?? media.posterPath }, season, from, to))
}

/**
 * Les sorties des abonnements du compte sur la période. Les fiches TMDB sont
 * gardées 6 h par le client TMDB : relire le calendrier ne rappelle pas TMDB.
 * Un abonnement en échec est passé (journalisé), les autres s'affichent.
 */
export async function subscriptionReleases(userId: number, from: string, to: string): Promise<{ releases: Release[]; failed: number }> {
  const subscriptions = listSubscriptions(userId)
  if (subscriptions.length === 0) return { releases: [], failed: 0 }
  try {
    getTmdb()
  } catch (error) {
    // Sans clé TMDB, aucun abonnement ne peut être lu : inutile d'en journaliser un par un.
    if (error instanceof NotConfiguredError) return { releases: [], failed: subscriptions.length }
    throw error
  }
  const releases: Release[] = []
  let failed = 0
  await eachLimited(subscriptions, 4, async (subscription) => {
    try {
      releases.push(...(await releasesOf(subscription, from, to)))
    } catch (error) {
      failed++
      console.warn(`[calendrier] abonnement ${subscription.mediaType}/${subscription.tmdbId} : ${errorMessage(error)}`)
    }
  })
  return { releases, failed }
}
