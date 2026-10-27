import 'server-only'
import { ServiceError } from '../http'
import { getRadarr } from '../services/arr/radarr'
import { getSonarr } from '../services/arr/sonarr'
import type { ArrRelease, SonarrSeries } from '../services/arr/types'
import { getSorraa, sorraaConfigured, type SorraaRejectionReason, type SorraaRelease, type SorraaUnit } from '../services/sorraa/client'
import { getTmdb } from '../services/tmdb/client'
import type { MediaType } from '../services/tmdb/types'
import { invalidateLibrary } from './library'
import { onyxShowEpisodes, withOnyxEpisode } from './onyx-episodes'
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

/** Le média chez sorraa ; un titre que personne n'a demandé y est ajouté. */
async function sorraaMediaId(mediaType: MediaType, tmdbId: number): Promise<number> {
  return (await getSorraa().addMedia(mediaType, tmdbId)).id
}

/** Les unités du média chez sorraa ; aucune s'il ne le connaît pas ou ne répond pas (la liste d'épisodes reste lisible). */
async function sorraaUnits(tmdbId: number): Promise<SorraaUnit[]> {
  try {
    const sorraa = getSorraa()
    const mediaId = await sorraa.mediaId('tv', tmdbId)
    return mediaId === null ? [] : await sorraa.units(mediaId)
  } catch {
    return []
  }
}

const REJECTIONS: Record<SorraaRejectionReason, string> = {
  quality_not_accepted: "qualité refusée par le profil",
  upgrades_not_allowed: 'le profil interdit de remplacer le fichier existant',
  cutoff_met: 'la qualité souhaitée est déjà atteinte',
  not_an_upgrade: "n'améliore pas le fichier existant",
  language_not_wanted: 'langue non souhaitée',
  language_required: 'aucune langue souhaitée',
  format_score_too_low: 'score des formats trop bas',
  wrong_title: 'ce n\'est pas le bon titre',
  wrong_year: "ce n'est pas la bonne année",
  wrong_unit: "ne contient pas le film, la saison ou l'épisode voulu",
  blocklisted: 'déjà échouée pour ce média',
  size_too_small: 'trop petite pour sa qualité',
  size_too_large: 'trop grosse pour sa qualité',
  undersized_for_quality: 'trop petite pour la qualité annoncée',
  seeders_too_low: 'pas assez de sources',
  pack_not_enough_upgrades: "le pack n'améliore pas assez d'épisodes",
  upgrade_paused: "mise à niveau en pause après un échec",
}

function fromSorraa(release: SorraaRelease): ArrRelease {
  const published = release.publishedAt ? Date.parse(release.publishedAt) : Number.NaN
  return {
    guid: release.id,
    indexerId: release.indexerId,
    indexer: release.indexer,
    title: release.name,
    size: release.size,
    seeders: release.seeders,
    leechers: release.leechers,
    protocol: release.protocol,
    ageHours: Number.isNaN(published) ? undefined : Math.max(0, (Date.now() - published) / 3_600_000),
    publishDate: release.publishedAt,
    quality: { quality: { name: release.release.quality } },
    languages: release.release.languages.map((language, index) => ({ id: index, name: language.toUpperCase() })),
    rejected: !release.decision.accepted,
    rejections: release.decision.rejections.map((rejection) => REJECTIONS[rejection.reason] ?? rejection.reason),
    infoUrl: release.infoUrl,
    customFormatScore: release.decision.formatScore,
  }
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
  /** L'épisode côté sorraa ou Sonarr (recherche interactive d'un épisode). */
  episodeId: number | null
}

/** Les épisodes d'une saison (TMDB), avec ce que sorraa ou Sonarr en a, et ce qu'Onyx peut lire (il prime pour « disponible »). */
export async function seasonEpisodes(tmdbId: number, seasonNumber: number, tvdbId?: number | null): Promise<SeasonEpisode[]> {
  if (sorraaConfigured()) {
    const [season, units, onyx] = await Promise.all([getTmdb().season(tmdbId, seasonNumber), sorraaUnits(tmdbId), onyxShowEpisodes(tmdbId)])
    const byNumber = new Map(units.filter((unit) => unit.kind === 'episode' && unit.seasonNumber === seasonNumber).map((unit) => [unit.episodeNumber, unit]))
    return season.episodes.map((episode) => {
      const tracked = byNumber.get(episode.episode_number)
      return {
        episodeNumber: episode.episode_number,
        name: episode.name,
        overview: episode.overview || null,
        airDate: episode.air_date,
        stillPath: episode.still_path,
        runtime: episode.runtime ?? null,
        hasFile: withOnyxEpisode(
          units.length > 0 ? tracked?.status === 'downloaded' || tracked?.status === 'upgradable' : null,
          onyx,
          seasonNumber,
          episode.episode_number,
        ),
        episodeId: tracked?.id ?? null,
      }
    })
  }
  const [season, series, onyx] = await Promise.all([getTmdb().season(tmdbId, seasonNumber), seriesFor(tmdbId, tvdbId).catch(() => null), onyxShowEpisodes(tmdbId)])
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
      hasFile: withOnyxEpisode(series?.id ? (tracked?.hasFile ?? false) : null, onyx, seasonNumber, episode.episode_number),
      episodeId: tracked?.id ?? null,
    }
  })
}

export type ReleaseScope = { seasonNumber?: number; episodeId?: number; episodeNumber?: number }

/** Recherche interactive : les releases que l'*arr trouve, les plus partagées d'abord, les refusées à la fin. */
export async function searchReleases(
  mediaType: MediaType,
  tmdbId: number,
  scope: ReleaseScope = {},
  tvdbId?: number | null,
): Promise<{ releases: ArrRelease[]; addedToLibrary: boolean }> {
  if (sorraaConfigured()) {
    // sorraa ne cherche que pour un média qu'il connaît : le titre y entre le temps de la recherche
    // (sans demande), et `discardSearchedMedia` l'en retire si aucune release n'est choisie.
    const sorraa = getSorraa()
    const { id: mediaId, created } = await sorraa.addMedia(mediaType, tmdbId)
    try {
      let unitId = scope.episodeId
      if (unitId === undefined && scope.seasonNumber !== undefined) {
        const units = await sorraa.units(mediaId)
        const wanted =
          scope.episodeNumber !== undefined
            ? units.find((unit) => unit.kind === 'episode' && unit.seasonNumber === scope.seasonNumber && unit.episodeNumber === scope.episodeNumber)
            : units.find((unit) => unit.kind === 'season' && unit.seasonNumber === scope.seasonNumber)
        if (!wanted) throw new ServiceError('sorraa', `sorraa ne connaît pas ${scope.episodeNumber !== undefined ? "cet épisode" : `la saison ${scope.seasonNumber}`}.`)
        unitId = wanted.id
      }
      return { releases: (await sorraa.searchReleases(mediaId, unitId)).map(fromSorraa), addedToLibrary: created }
    } catch (error) {
      if (created) await sorraa.removeMedia(mediaId, false).catch(() => {})
      throw error
    }
  }
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
  return {
    releases: [...releases].sort((a, b) => Number(Boolean(a.rejected)) - Number(Boolean(b.rejected)) || (b.seeders ?? 0) - (a.seeders ?? 0)),
    addedToLibrary: false,
  }
}

/** Fin d'une recherche interactive sans release choisie : sorraa oublie le titre ajouté pour elle, sauf si quelqu'un l'a demandé entre-temps. */
export async function discardSearchedMedia(mediaType: MediaType, tmdbId: number): Promise<void> {
  if (!sorraaConfigured()) return
  const sorraa = getSorraa()
  if ((await sorraa.requestsFor(mediaType, tmdbId)).length > 0) return
  const mediaId = await sorraa.mediaId(mediaType, tmdbId)
  if (mediaId !== null) await sorraa.removeMedia(mediaId, false)
}

export async function grabRelease(mediaType: MediaType, release: Pick<ArrRelease, 'guid' | 'indexerId'>): Promise<void> {
  if (sorraaConfigured()) await getSorraa().grab(release.guid)
  else if (mediaType === 'movie') await getRadarr().grabRelease(release)
  else await getSonarr().grabRelease(release)
  invalidateLibrary()
}

/** Recherche automatique : le film, une saison, ou toute la série. */
export async function automaticSearch(mediaType: MediaType, tmdbId: number, seasonNumber?: number, tvdbId?: number | null): Promise<void> {
  if (sorraaConfigured()) {
    // sorraa cherche tout ce qui manque au média, pas une saison à part.
    await getSorraa().search(await sorraaMediaId(mediaType, tmdbId))
    return
  }
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
