import type { TmdbReleaseDates, TmdbSeason, TmdbSeasonSummary } from '../services/tmdb/types'
import { episodeCode, type Release, type ReleaseKind } from './releases'

/**
 * Les sorties d'un abonnement, lues dans TMDB : un média que Radarr/Sonarr ne
 * suivent pas n'a que TMDB pour dire quand il sort. Fonctions pures.
 */
export interface SubscribedMedia {
  tmdbId: number
  title: string
  posterPath: string | null
}

const KIND_BY_TYPE: Record<number, ReleaseKind> = { 2: 'cinema', 3: 'cinema', 4: 'digital', 5: 'physical' }
const REGIONS = ['FR', 'US'] as const

function inRange(date: string | null | undefined, from: string, to: string): date is string {
  return typeof date === 'string' && date >= from && date <= to
}

/**
 * Une ligne par type de sortie (cinéma, numérique, physique), à la date
 * française, sinon américaine ; sans aucune des deux, la date de sortie
 * principale de la fiche compte comme sortie cinéma.
 */
export function tmdbMovieReleases(movie: SubscribedMedia, dates: TmdbReleaseDates, fallbackDate: string | null | undefined, from: string, to: string): Release[] {
  const byKind = new Map<ReleaseKind, string>()
  for (const region of REGIONS) {
    const entries = dates.results.find((result) => result.iso_3166_1 === region)?.release_dates ?? []
    for (const entry of entries) {
      const kind = KIND_BY_TYPE[entry.type]
      const day = entry.release_date.slice(0, 10)
      if (!kind || !/^\d{4}-\d{2}-\d{2}$/.test(day)) continue
      const known = byKind.get(kind)
      if (!known || day < known) byKind.set(kind, day)
    }
    if (byKind.size > 0) break
  }
  if (byKind.size === 0 && fallbackDate) byKind.set('cinema', fallbackDate.slice(0, 10))

  return [...byKind]
    .filter(([, date]) => inRange(date, from, to))
    .map(([kind, date]) => ({
      id: `tmdb-movie-${movie.tmdbId}-${kind}`,
      date,
      kind,
      mediaType: 'movie',
      tmdbId: movie.tmdbId,
      title: movie.title,
      subtitle: null,
      posterPath: movie.posterPath,
      hasFile: false,
      episode: null,
      source: 'subscription',
    }))
}

/**
 * Les saisons dont les épisodes peuvent tomber dans la période : une saison
 * court de sa date de début jusqu'au début de la suivante, la dernière sans fin.
 * Évite de lire toutes les saisons d'une série de vingt ans.
 */
export function seasonsOverlapping(seasons: readonly TmdbSeasonSummary[], from: string, to: string): number[] {
  const dated = seasons
    .flatMap((season) => (season.season_number > 0 && season.air_date ? [{ number: season.season_number, start: season.air_date }] : []))
    .sort((a, b) => a.number - b.number)
  return dated
    .filter((season, index) => {
      const next = dated[index + 1]?.start
      return season.start <= to && (!next || next > from)
    })
    .map((season) => season.number)
}

export function tmdbEpisodeReleases(show: SubscribedMedia, season: TmdbSeason, from: string, to: string): Release[] {
  return season.episodes.flatMap((episode): Release[] => {
    if (!inRange(episode.air_date, from, to)) return []
    const code = episodeCode(episode.season_number, episode.episode_number)
    return [
      {
        id: `tmdb-episode-${show.tmdbId}-${episode.season_number}-${episode.episode_number}`,
        date: episode.air_date,
        kind: 'episode',
        mediaType: 'tv',
        tmdbId: show.tmdbId,
        title: show.title,
        subtitle: episode.name ? `${code} · ${episode.name}` : code,
        posterPath: show.posterPath,
        hasFile: false,
        episode: { season: episode.season_number, number: episode.episode_number },
        source: 'subscription',
      },
    ]
  })
}

const TV_ONGOING = new Set(['Returning Series', 'In Production', 'Planned', 'Pilot'])
/** Un film sorti depuis moins de six mois peut encore sortir en numérique ou en Blu-ray. */
const MOVIE_WINDOW_DAYS = 180

/** Le bouton « S'abonner » n'a de sens que pour un média qui a encore des sorties devant lui. */
export function isSubscribable(
  mediaType: 'movie' | 'tv',
  details: { status?: string; in_production?: boolean; release_date?: string },
  today: string,
): boolean {
  if (mediaType === 'tv') return details.in_production === true || TV_ONGOING.has(details.status ?? '')
  if (details.status !== 'Released' || !details.release_date) return true
  const limit = new Date(`${today}T00:00:00Z`)
  limit.setUTCDate(limit.getUTCDate() - MOVIE_WINDOW_DAYS)
  return details.release_date >= limit.toISOString().slice(0, 10)
}
