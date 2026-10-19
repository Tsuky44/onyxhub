import type { MediaType } from '../services/tmdb/types'

/**
 * Les gardes des arguments de server actions : une action est un point
 * d'entrée public, ses arguments ne sont jamais fiables.
 */
export const isMediaType = (value: unknown): value is MediaType => value === 'movie' || value === 'tv'
export const isTmdbId = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0

export interface MediaItem {
  mediaType: MediaType
  tmdbId: number
  title: string
  posterPath: string | null
}

/** Le média reçu d'un client, nettoyé, ou `null` s'il est invalide. */
export function cleanMediaItem(item: unknown): MediaItem | null {
  if (typeof item !== 'object' || item === null) return null
  const { mediaType, tmdbId, title, posterPath } = item as Record<string, unknown>
  if (!isMediaType(mediaType) || !isTmdbId(tmdbId) || typeof title !== 'string') return null
  return { mediaType, tmdbId, title: title.slice(0, 300), posterPath: typeof posterPath === 'string' && posterPath.startsWith('/') ? posterPath : null }
}
