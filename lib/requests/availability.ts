import type { RadarrMovie, SonarrSeries } from '../services/arr/types'
import type { AvailabilityStatus } from './status'

/**
 * La disponibilité d'un média d'après Radarr/Sonarr, avec les règles de
 * MediaHub (`lib/services/media-status.ts`), plus « en cours » quand un
 * téléchargement est dans la file : MediaHub ne le calculait jamais, et ses
 * demandes restaient « approuvées » pendant tout le téléchargement.
 *
 * Fonctions pures : l'index de bibliothèque (`library.ts`) leur passe la fiche
 * *arr et ce qui se télécharge.
 */
export interface SeasonAvailability {
  seasonNumber: number
  status: AvailabilityStatus
  available: boolean
  totalEpisodes: number
  episodeFileCount: number
}

export interface Availability {
  status: AvailabilityStatus
  available: boolean
  seasons: SeasonAvailability[]
}

export const UNKNOWN_AVAILABILITY: Availability = { status: 'unknown', available: false, seasons: [] }

function of(status: AvailabilityStatus, seasons: SeasonAvailability[] = []): Availability {
  return { status, available: status === 'available' || status === 'partial', seasons }
}

export function movieAvailability(movie: RadarrMovie | undefined, downloading: boolean): Availability {
  if (!movie?.id) return UNKNOWN_AVAILABILITY
  if (movie.hasFile) return of('available')
  if (downloading) return of('processing')
  if (movie.monitored) return of('pending')
  return UNKNOWN_AVAILABILITY
}

function seasonStatus(complete: boolean, downloading: boolean, hasFiles: boolean, monitored: boolean): AvailabilityStatus {
  if (complete) return 'available'
  if (downloading) return 'processing'
  if (hasFiles) return 'partial'
  if (monitored) return 'pending'
  return 'unknown'
}

export function seriesAvailability(series: SonarrSeries | undefined, downloadingSeasons: ReadonlySet<number>): Availability {
  if (!series?.id) return UNKNOWN_AVAILABILITY

  const seasons = (series.seasons ?? []).map((season): SeasonAvailability => {
    // `totalEpisodeCount` compte aussi les épisodes pas encore diffusés : une
    // saison en cours de diffusion reste « partielle » jusqu'au dernier.
    const totalEpisodes = season.statistics?.totalEpisodeCount ?? 0
    const episodeFileCount = season.statistics?.episodeFileCount ?? 0
    const complete = totalEpisodes > 0 && episodeFileCount >= totalEpisodes
    return {
      seasonNumber: season.seasonNumber,
      status: seasonStatus(complete, downloadingSeasons.has(season.seasonNumber), episodeFileCount > 0, season.monitored),
      available: episodeFileCount > 0,
      totalEpisodes,
      episodeFileCount,
    }
  })

  // Les épisodes spéciaux (saison 0) ne comptent pas pour la série entière.
  const regular = seasons.filter((season) => season.seasonNumber > 0)
  const withEpisodes = regular.filter((season) => season.totalEpisodes > 0)

  let status: AvailabilityStatus = 'unknown'
  if (withEpisodes.length > 0 && withEpisodes.every((season) => season.status === 'available')) status = 'available'
  else if (withEpisodes.some((season) => season.available)) status = 'partial'
  else if (regular.some((season) => season.status === 'processing')) status = 'processing'
  else if (regular.some((season) => season.status === 'pending')) status = 'pending'

  return of(status, seasons)
}

/** La disponibilité d'une saison précise (une ligne de demande). */
export function seasonAvailability(availability: Availability, seasonNumber: number | null): AvailabilityStatus {
  if (seasonNumber === null) return availability.status
  return availability.seasons.find((season) => season.seasonNumber === seasonNumber)?.status ?? 'unknown'
}
