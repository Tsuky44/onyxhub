import 'server-only'
import { inArray } from 'drizzle-orm'
import { getDb } from '../db'
import { mediaRequests } from '../db/schema'
import { errorMessage, NotConfiguredError } from '../http'
import { getRadarr } from '../services/arr/radarr'
import { getSonarr } from '../services/arr/sonarr'
import { getSorraa, sorraaConfigured } from '../services/sorraa/client'
import { TtlCache } from '../ttl-cache'
import { episodeReleases, groupEpisodeDrops, mergeReleases, movieReleases, sorraaReleases, sortReleases, type Release } from './releases'
import { subscriptionReleases } from './subscriptions'

/**
 * Les sorties d'une période : celles que Radarr et Sonarr surveillent (donc
 * ce qui a été demandé, gardées 5 minutes : le calendrier bouge peu), plus
 * celles des abonnements du compte, lues dans TMDB.
 */
export interface UpcomingRelease extends Release {
  /** Demandé par le compte qui regarde. */
  mine: boolean
  /** Le compte qui regarde est abonné au média. */
  subscribed: boolean
}

export interface CalendarData {
  releases: UpcomingRelease[]
  /** Les services qui n'ont pas répondu (un service non configuré n'y figure pas : ce n'est pas une panne). */
  unavailable: string[]
  /** Abonnements dont TMDB n'a pas donné les dates. */
  failedSubscriptions: number
}

type LibraryReleases = { releases: Release[]; unavailable: string[]; complete: boolean }

const cache = new TtlCache<LibraryReleases>(5 * 60_000, 50)
/** Un calendrier incomplet (service absent ou en panne) n'est gardé que 15 s : brancher Radarr se voit tout de suite. */
const INCOMPLETE_TTL_MS = 15_000

async function fetchLibraryReleases(from: string, to: string): Promise<LibraryReleases> {
  let complete = true
  const unavailable: string[] = []
  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T23:59:59`)
  const settle = async <T,>(service: string, load: () => Promise<T[]>): Promise<T[]> => {
    try {
      return await load()
    } catch (error) {
      complete = false
      if (!(error instanceof NotConfiguredError)) {
        unavailable.push(service)
        console.warn(`[calendrier] ${service} : ${errorMessage(error)}`)
      }
      return []
    }
  }
  const [movies, episodes, fromSorraa] = await Promise.all([
    settle('Radarr', () => getRadarr().calendar(start, end)),
    settle('Sonarr', () => getSonarr().calendar(start, end)),
    // Dès que sorraa est branché, les demandes y vivent : Radarr et Sonarr ne les voient plus.
    sorraaConfigured()
      ? settle('sorraa', async () => {
          const entries = await getSorraa().calendar(from, to)
          // L'index ne sert qu'aux affiches et aux liens TMDB : sans lui les sorties s'affichent quand même.
          const media = entries.length > 0 ? await getSorraa().mediaIndex().catch((error: unknown) => {
            console.error(`calendrier: index des médias sorraa illisible (${errorMessage(error)})`)
            return new Map<number, { tmdbId: number; posterPath: string | null }>()
          }) : new Map<number, { tmdbId: number; posterPath: string | null }>()
          return sorraaReleases(entries, media)
        })
      : Promise.resolve([] as Release[]),
  ])
  const arr = [...movieReleases(movies, from, to), ...episodeReleases(episodes, from, to)]
  return { releases: mergeReleases(arr, fromSorraa), unavailable, complete }
}

async function libraryReleases(from: string, to: string): Promise<LibraryReleases> {
  const key = `${from}|${to}`
  const hit = cache.get(key)
  if (hit) return hit
  const result = await fetchLibraryReleases(from, to)
  cache.set(key, result, result.complete ? undefined : INCOMPLETE_TTL_MS)
  return result
}

/** Les sorties du jour `from` au jour `to` (AAAA-MM-JJ, inclus), vues par un compte. */
export async function calendarData(from: string, to: string, viewer: { id: number; name: string }): Promise<CalendarData> {
  const [library, subscribed] = await Promise.all([libraryReleases(from, to), subscriptionReleases(viewer.id, from, to)])
  const releases = sortReleases(groupEpisodeDrops(mergeReleases(library.releases, subscribed.releases)))
  const tmdbIds = [...new Set(releases.flatMap((release) => (release.tmdbId ? [release.tmdbId] : [])))]
  const rows =
    tmdbIds.length === 0
      ? []
      : getDb()
          .select({ mediaType: mediaRequests.mediaType, tmdbId: mediaRequests.tmdbId, requester: mediaRequests.requester, posterPath: mediaRequests.posterPath })
          .from(mediaRequests)
          .where(inArray(mediaRequests.tmdbId, tmdbIds))
          .all()
  const key = (type: string, id: number | null) => `${type}:${id}`
  const mine = new Set(rows.filter((row) => row.requester === viewer.name).map((row) => key(row.mediaType, row.tmdbId)))
  const subscriptions = new Set(subscribed.releases.map((release) => key(release.mediaType, release.tmdbId)))
  // Les affiches Sonarr viennent de TVDB : celle de la demande (TMDB) les remplace.
  const posters = new Map(rows.filter((row) => row.posterPath).map((row) => [key(row.mediaType, row.tmdbId), row.posterPath]))
  return {
    releases: releases.map((release) => ({
      ...release,
      posterPath: release.posterPath ?? posters.get(key(release.mediaType, release.tmdbId)) ?? null,
      mine: mine.has(key(release.mediaType, release.tmdbId)),
      subscribed: subscriptions.has(key(release.mediaType, release.tmdbId)),
    })),
    unavailable: library.unavailable,
    failedSubscriptions: subscribed.failed,
  }
}
