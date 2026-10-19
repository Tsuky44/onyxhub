import type { ArrImage, RadarrCalendarMovie, SonarrCalendarEpisode } from '../services/arr/types'

/**
 * Les sorties lues dans les calendriers Radarr et Sonarr, sous une forme
 * commune : une date (jour local), un type de sortie et de quoi afficher une
 * ligne. Fonctions pures, partagées par l'accueil et le calendrier.
 */
export type ReleaseKind = 'cinema' | 'digital' | 'physical' | 'episode'

export interface Release {
  /** Stable d'un rendu à l'autre (clé React, déduplication). */
  id: string
  /** Jour de sortie, AAAA-MM-JJ. */
  date: string
  kind: ReleaseKind
  mediaType: 'movie' | 'tv'
  tmdbId: number | null
  title: string
  /** « S02E05 · Titre » pour un épisode. */
  subtitle: string | null
  posterPath: string | null
  /** Le fichier est déjà là. */
  hasFile: boolean
}

export const RELEASE_KIND_LABELS: Record<ReleaseKind, string> = {
  cinema: 'Au cinéma',
  digital: 'En numérique',
  physical: 'En Blu-ray / DVD',
  episode: 'Épisode',
}

/** Le chemin TMDB d'une image *arr (`…/t/p/original/abc.jpg` → `/abc.jpg`), sinon `null` (affiche TVDB). */
export function tmdbPosterPath(images: readonly ArrImage[] | undefined): string | null {
  const poster = images?.find((image) => image.coverType === 'poster')
  const match = poster?.remoteUrl?.match(/image\.tmdb\.org\/t\/p\/[^/]+(\/[^/?]+)/)
  return match?.[1] ?? null
}

/** Le jour local (AAAA-MM-JJ) d'un instant, dans le fuseau du serveur. */
export function localDay(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function dayOf(value: string | undefined): string | null {
  if (!value) return null
  // Radarr donne des dates à minuit UTC : seul le jour compte, sans décalage de fuseau.
  if (/^\d{4}-\d{2}-\d{2}/.test(value) && value.includes('T00:00:00')) return value.slice(0, 10)
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : localDay(parsed)
}

export function movieReleases(movies: readonly RadarrCalendarMovie[], from: string, to: string): Release[] {
  const releases: Release[] = []
  for (const movie of movies) {
    const dates: [ReleaseKind, string | undefined][] = [
      ['cinema', movie.inCinemas],
      ['digital', movie.digitalRelease],
      ['physical', movie.physicalRelease],
    ]
    for (const [kind, raw] of dates) {
      const date = dayOf(raw)
      if (!date || date < from || date > to) continue
      releases.push({
        id: `movie-${movie.tmdbId}-${kind}`,
        date,
        kind,
        mediaType: 'movie',
        tmdbId: movie.tmdbId,
        title: movie.title,
        subtitle: null,
        posterPath: tmdbPosterPath(movie.images),
        hasFile: movie.hasFile,
      })
    }
  }
  return releases
}

const pad2 = (value: number) => String(value).padStart(2, '0')

export function episodeReleases(episodes: readonly SonarrCalendarEpisode[], from: string, to: string): Release[] {
  return episodes.flatMap((episode): Release[] => {
    const date = dayOf(episode.airDateUtc ?? episode.airDate)
    if (!date || date < from || date > to) return []
    const code = `S${pad2(episode.seasonNumber)}E${pad2(episode.episodeNumber)}`
    return [
      {
        id: `episode-${episode.id}`,
        date,
        kind: 'episode',
        mediaType: 'tv',
        tmdbId: episode.series?.tmdbId ?? null,
        title: episode.series?.title ?? 'Série',
        subtitle: episode.title ? `${code} · ${episode.title}` : code,
        posterPath: tmdbPosterPath(episode.series?.images),
        hasFile: episode.hasFile,
      },
    ]
  })
}

export function sortReleases(releases: Release[]): Release[] {
  return releases.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'fr') || a.id.localeCompare(b.id))
}
