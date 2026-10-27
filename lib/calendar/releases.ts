import type { SorraaCalendarEntry } from '../services/sorraa/client'
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
  /** « S02E05 · Titre » pour un épisode, « S02 · Épisodes 1 à 8 » pour une saison sortie d'un coup. */
  subtitle: string | null
  posterPath: string | null
  /** Le fichier est déjà là (toujours `false` pour un abonnement : rien ne le dit). */
  hasFile: boolean
  /** Saison et numéro d'un épisode : sert à regrouper et à dédoublonner. */
  episode: { season: number; number: number } | null
  /** Radarr/Sonarr (le serveur le suit) ou TMDB (un abonnement du compte). */
  source: 'library' | 'subscription'
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
        episode: null,
        source: 'library',
      })
    }
  }
  return releases
}

const pad2 = (value: number) => String(value).padStart(2, '0')

export function episodeCode(season: number, episode: number): string {
  return `S${pad2(season)}E${pad2(episode)}`
}

export function episodeReleases(episodes: readonly SonarrCalendarEpisode[], from: string, to: string): Release[] {
  return episodes.flatMap((episode): Release[] => {
    const date = dayOf(episode.airDateUtc ?? episode.airDate)
    if (!date || date < from || date > to) return []
    const code = episodeCode(episode.seasonNumber, episode.episodeNumber)
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
        episode: { season: episode.seasonNumber, number: episode.episodeNumber },
        source: 'library',
      },
    ]
  })
}

/** Les sorties du calendrier de sorraa ; `media` donne TMDB et l'affiche de chaque média. */
export function sorraaReleases(
  entries: readonly SorraaCalendarEntry[],
  media: ReadonlyMap<number, { tmdbId: number; posterPath: string | null }>,
): Release[] {
  return entries.flatMap((entry): Release[] => {
    // Pas de filtre sur `monitored` : un titre ajouté à sorraa sans être demandé n'est pas surveillé,
    // et le calendrier restait vide alors que sorraa avait bien des sorties à donner.
    if (entry.unitKind === 'season') return []
    const known = media.get(entry.mediaId)
    const hasFile = entry.status === 'downloaded' || entry.status === 'upgradable'
    const base = { date: entry.date, title: entry.mediaTitle, tmdbId: known?.tmdbId ?? null, posterPath: known?.posterPath ?? null, hasFile, source: 'library' as const }
    if (entry.unitKind === 'movie') {
      return [{ ...base, id: `sorraa-movie-${entry.mediaId}`, kind: 'digital', mediaType: 'movie', subtitle: null, episode: null }]
    }
    const season = entry.seasonNumber ?? 0
    const number = entry.episodeNumber ?? 0
    const code = episodeCode(season, number)
    return [
      {
        ...base,
        id: `sorraa-episode-${entry.mediaId}-${season}-${number}`,
        kind: 'episode',
        mediaType: 'tv',
        subtitle: entry.title ? `${code} · ${entry.title}` : code,
        episode: { season, number },
      },
    ]
  })
}

export function sortReleases(releases: Release[]): Release[] {
  return releases.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'fr') || a.id.localeCompare(b.id))
}

/** Une même sortie vue par Radarr/Sonarr et par TMDB a la même clé. */
export function releaseKey(release: Release): string {
  const media = `${release.mediaType}:${release.tmdbId ?? release.title}`
  return release.episode ? `${media}:${release.episode.season}:${release.episode.number}` : `${media}:${release.kind}`
}

/** Les sorties des abonnements s'ajoutent à celles du serveur, qui gagnent quand les deux ont la même (elles savent si le fichier est là). */
export function mergeReleases(library: readonly Release[], subscribed: readonly Release[]): Release[] {
  const known = new Set(library.map(releaseKey))
  return [...library, ...subscribed.filter((release) => !known.has(releaseKey(release)))]
}

function episodeRange(numbers: readonly number[]): string {
  const sorted = [...numbers].sort((a, b) => a - b)
  const first = sorted[0] ?? 0
  const last = sorted[sorted.length - 1] ?? 0
  return last - first === sorted.length - 1 ? `Épisodes ${first} à ${last}` : `${sorted.length} épisodes`
}

/**
 * Les épisodes d'une même saison sortis le même jour deviennent une seule
 * ligne : une saison Netflix ne remplit plus la journée de huit lignes.
 * Même règle que MediaHub, qui regroupait par série, saison et jour.
 */
export function groupEpisodeDrops(releases: readonly Release[]): Release[] {
  const groups = new Map<string, Release[]>()
  const order: (Release | string)[] = []
  for (const release of releases) {
    if (!release.episode) {
      order.push(release)
      continue
    }
    const key = `${release.tmdbId ?? release.title}|${release.episode.season}|${release.date}|${release.source}`
    const group = groups.get(key)
    if (group) group.push(release)
    else {
      groups.set(key, [release])
      order.push(key)
    }
  }
  return order.flatMap((item): Release[] => {
    if (typeof item !== 'string') return [item]
    const group = groups.get(item) ?? []
    const [first] = group
    if (!first?.episode) return []
    if (group.length === 1) return [first]
    return [
      {
        ...first,
        id: `drop-${first.id}`,
        subtitle: `S${pad2(first.episode.season)} · ${episodeRange(group.flatMap((release) => (release.episode ? [release.episode.number] : [])))}`,
        hasFile: group.every((release) => release.hasFile),
      },
    ]
  })
}
