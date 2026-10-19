import 'server-only'
import { inArray } from 'drizzle-orm'
import { getDb } from '../db'
import { mediaRequests } from '../db/schema'
import { errorMessage, NotConfiguredError } from '../http'
import { getRadarr } from '../services/arr/radarr'
import { getSonarr } from '../services/arr/sonarr'
import { TtlCache } from '../ttl-cache'
import { episodeReleases, localDay, movieReleases, sortReleases, type Release } from './releases'

/**
 * Les sorties d'une période, lues dans Radarr et Sonarr (ce qu'ils surveillent,
 * donc ce qui a été demandé), gardées 5 minutes : le calendrier bouge peu.
 */
export interface UpcomingRelease extends Release {
  /** Demandé par le compte qui regarde. */
  mine: boolean
}

const cache = new TtlCache<Release[]>(5 * 60_000, 50)
/** Un calendrier incomplet (service absent ou en panne) n'est gardé que 15 s : brancher Radarr se voit tout de suite. */
const INCOMPLETE_TTL_MS = 15_000

async function fetchReleases(from: string, to: string): Promise<{ releases: Release[]; complete: boolean }> {
  let complete = true
  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T23:59:59`)
  const settle = async <T>(service: string, load: () => Promise<T[]>): Promise<T[]> => {
    try {
      return await load()
    } catch (error) {
      complete = false
      if (!(error instanceof NotConfiguredError)) console.warn(`[calendrier] ${service} : ${errorMessage(error)}`)
      return []
    }
  }
  const [movies, episodes] = await Promise.all([
    settle('Radarr', () => getRadarr().calendar(start, end)),
    settle('Sonarr', () => getSonarr().calendar(start, end)),
  ])
  return { releases: sortReleases([...movieReleases(movies, from, to), ...episodeReleases(episodes, from, to)]), complete }
}

async function cachedReleases(from: string, to: string): Promise<Release[]> {
  const key = `${from}|${to}`
  const hit = cache.get(key)
  if (hit) return hit
  const { releases, complete } = await fetchReleases(from, to)
  cache.set(key, releases, complete ? undefined : INCOMPLETE_TTL_MS)
  return releases
}

/** Les sorties du jour `from` au jour `to` (AAAA-MM-JJ, inclus). */
export async function releasesBetween(from: string, to: string, viewer: string): Promise<UpcomingRelease[]> {
  const releases = await cachedReleases(from, to)
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
  const mine = new Set(rows.filter((row) => row.requester === viewer).map((row) => key(row.mediaType, row.tmdbId)))
  // Les affiches Sonarr viennent de TVDB : celle de la demande (TMDB) les remplace.
  const posters = new Map(rows.filter((row) => row.posterPath).map((row) => [key(row.mediaType, row.tmdbId), row.posterPath]))
  return releases.map((release) => ({
    ...release,
    posterPath: release.posterPath ?? posters.get(key(release.mediaType, release.tmdbId)) ?? null,
    mine: mine.has(key(release.mediaType, release.tmdbId)),
  }))
}

/** Les `days` prochains jours, aujourd'hui compris. */
export function upcoming(days: number, viewer: string, now = new Date()): Promise<UpcomingRelease[]> {
  const end = new Date(now)
  end.setDate(end.getDate() + days - 1)
  return releasesBetween(localDay(now), localDay(end), viewer)
}
