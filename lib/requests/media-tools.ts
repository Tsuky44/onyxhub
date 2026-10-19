import 'server-only'
import { ServiceError } from '../http'
import { getRadarr } from '../services/arr/radarr'
import { getSonarr } from '../services/arr/sonarr'
import type { ArrRelease, SonarrSeries } from '../services/arr/types'
import { getTmdb } from '../services/tmdb/client'
import type { MediaType } from '../services/tmdb/types'
import { invalidateLibrary } from './library'
import { knownTvdbIds } from './repository'

/**
 * Les outils de la fiche : épisodes d'une saison, recherche automatique et
 * recherche interactive des releases (admin). Tout passe par Radarr/Sonarr,
 * qui doivent déjà connaître le média.
 */

async function seriesFor(tmdbId: number, tvdbId?: number | null): Promise<SonarrSeries | null> {
  const id = tvdbId ?? knownTvdbIds([tmdbId]).get(tmdbId) ?? (await getTmdb().externalIds('tv', tmdbId)).tvdb_id
  return id ? getSonarr().seriesByTvdbId(id) : null
}

function notInLibrary(service: string): ServiceError {
  return new ServiceError(service, `${service} ne connaît pas encore ce média : demande-le d'abord.`)
}

export interface SeasonEpisode {
  episodeNumber: number
  name: string
  overview: string | null
  airDate: string | null
  stillPath: string | null
  runtime: number | null
  /** `null` : Sonarr ne suit pas la série. */
  hasFile: boolean | null
  /** L'épisode côté Sonarr (recherche interactive d'un épisode). */
  sonarrEpisodeId: number | null
}

/** Les épisodes d'une saison (TMDB), avec ce que Sonarr en a. */
export async function seasonEpisodes(tmdbId: number, seasonNumber: number, tvdbId?: number | null): Promise<SeasonEpisode[]> {
  const [season, series] = await Promise.all([getTmdb().season(tmdbId, seasonNumber), seriesFor(tmdbId, tvdbId).catch(() => null)])
  const sonarrEpisodes = series?.id ? (await getSonarr().episodes(series.id).catch(() => [])).filter((episode) => episode.seasonNumber === seasonNumber) : []
  const byNumber = new Map(sonarrEpisodes.map((episode) => [episode.episodeNumber, episode]))
  return season.episodes.map((episode) => {
    const tracked = byNumber.get(episode.episode_number)
    return {
      episodeNumber: episode.episode_number,
      name: episode.name,
      overview: episode.overview || null,
      airDate: episode.air_date,
      stillPath: episode.still_path,
      runtime: episode.runtime ?? null,
      hasFile: series?.id ? (tracked?.hasFile ?? false) : null,
      sonarrEpisodeId: tracked?.id ?? null,
    }
  })
}

export type ReleaseScope = { seasonNumber?: number; episodeId?: number }

/** Recherche interactive : les releases que l'*arr trouve, les plus partagées d'abord, les refusées à la fin. */
export async function searchReleases(mediaType: MediaType, tmdbId: number, scope: ReleaseScope = {}, tvdbId?: number | null): Promise<ArrRelease[]> {
  let releases: ArrRelease[]
  if (mediaType === 'movie') {
    const movie = await getRadarr().movieByTmdbId(tmdbId)
    if (!movie?.id) throw notInLibrary('Radarr')
    releases = await getRadarr().releases(movie.id)
  } else {
    const series = await seriesFor(tmdbId, tvdbId)
    if (!series?.id) throw notInLibrary('Sonarr')
    if (scope.episodeId) releases = await getSonarr().releases({ episodeId: scope.episodeId })
    else releases = await getSonarr().releases({ seriesId: series.id, seasonNumber: scope.seasonNumber ?? 1 })
  }
  return [...releases].sort((a, b) => Number(Boolean(a.rejected)) - Number(Boolean(b.rejected)) || (b.seeders ?? 0) - (a.seeders ?? 0))
}

export async function grabRelease(mediaType: MediaType, release: Pick<ArrRelease, 'guid' | 'indexerId'>): Promise<void> {
  if (mediaType === 'movie') await getRadarr().grabRelease(release)
  else await getSonarr().grabRelease(release)
  invalidateLibrary()
}

/** Recherche automatique : le film, une saison, ou toute la série. */
export async function automaticSearch(mediaType: MediaType, tmdbId: number, seasonNumber?: number, tvdbId?: number | null): Promise<void> {
  if (mediaType === 'movie') {
    const movie = await getRadarr().movieByTmdbId(tmdbId)
    if (!movie?.id) throw notInLibrary('Radarr')
    await getRadarr().search(movie.id)
    return
  }
  const series = await seriesFor(tmdbId, tvdbId)
  if (!series?.id) throw notInLibrary('Sonarr')
  if (seasonNumber === undefined) await getSonarr().searchSeries(series.id)
  else await getSonarr().searchSeason(series.id, seasonNumber)
}
