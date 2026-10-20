import type { Availability } from './availability'
import type { RequestInput } from './create'
import type { MediaType } from '../services/tmdb/types'

/**
 * Les formats que le serveur Onyx connaît : les deux de MediaHub, repris à
 * l'identique (ADR-0002), et ceux qu'OnyxHub ajoute (ADR-0009).
 * `server/handlers/mediahub*.go` dans Onyx les lit : les changer impose de
 * changer Onyx dans le même mouvement.
 */

/** Corps de `POST /api/request` : `{ tmdbId, mediaType, title?, posterPath?, seasons? }`. */
export function parseRequestBody(body: unknown): { ok: true; input: RequestInput } | { ok: false; message: string } {
  if (typeof body !== 'object' || body === null) return { ok: false, message: 'Corps JSON attendu.' }
  const raw = body as Record<string, unknown>

  // Onyx envoie un nombre ; une chaîne de chiffres passe aussi, comme chez MediaHub (`parseInt`).
  const tmdbId = typeof raw.tmdbId === 'string' ? Number(raw.tmdbId) : raw.tmdbId
  if (typeof tmdbId !== 'number' || !Number.isInteger(tmdbId) || tmdbId <= 0) return { ok: false, message: 'tmdbId manquant ou invalide.' }
  if (raw.mediaType !== 'movie' && raw.mediaType !== 'tv') return { ok: false, message: 'mediaType doit valoir movie ou tv.' }

  // `seasons` : un nombre ou une liste de nombres (MediaHub acceptait les deux).
  const seasonsRaw = raw.seasons === undefined || raw.seasons === null ? [] : Array.isArray(raw.seasons) ? raw.seasons : [raw.seasons]
  const seasons: number[] = []
  for (const season of seasonsRaw) {
    const number = typeof season === 'string' ? Number(season) : season
    if (typeof number !== 'number' || !Number.isInteger(number) || number < 0) return { ok: false, message: 'seasons doit contenir des numéros de saison.' }
    seasons.push(number)
  }

  return {
    ok: true,
    input: {
      tmdbId,
      mediaType: raw.mediaType,
      seasons: raw.mediaType === 'tv' && seasons.length > 0 ? seasons : undefined,
      title: typeof raw.title === 'string' ? raw.title : undefined,
      posterPath: typeof raw.posterPath === 'string' ? raw.posterPath : undefined,
    },
  }
}

/** Ce que demande `POST /api/media/availability` : une page du catalogue d'Onyx en un appel (ADR-0009). */
export interface AvailabilityQuery {
  tmdbId: number
  mediaType: MediaType
}

/** Une page de catalogue TMDB fait 20 cartes ; 100 laisse de la marge sans ouvrir la porte à un balayage de toute la bibliothèque. */
export const MAX_BATCH_ITEMS = 100

/** Corps de `POST /api/media/availability` : `{ items: [{ tmdbId, mediaType }] }`. */
export function parseAvailabilityBatch(body: unknown): { ok: true; items: AvailabilityQuery[] } | { ok: false; message: string } {
  const rawItems = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).items : undefined
  if (!Array.isArray(rawItems)) return { ok: false, message: 'items doit être une liste.' }
  if (rawItems.length > MAX_BATCH_ITEMS) return { ok: false, message: `Au plus ${MAX_BATCH_ITEMS} médias par appel.` }
  const items: AvailabilityQuery[] = []
  for (const raw of rawItems) {
    const item = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
    if (typeof item.tmdbId !== 'number' || !Number.isInteger(item.tmdbId) || item.tmdbId <= 0) return { ok: false, message: 'tmdbId manquant ou invalide.' }
    if (item.mediaType !== 'movie' && item.mediaType !== 'tv') return { ok: false, message: 'mediaType doit valoir movie ou tv.' }
    items.push({ tmdbId: item.tmdbId, mediaType: item.mediaType })
  }
  return { ok: true, items }
}

/** Réponse de `POST /api/media/availability` : les disponibilités dans l'ordre de la question. */
export function availabilityBatchPayload(results: readonly { query: AvailabilityQuery; availability: Availability }[]) {
  return {
    results: results.map(({ query, availability }) => ({ tmdbId: query.tmdbId, mediaType: query.mediaType, ...availabilityPayload(availability) })),
  }
}

/** Réponse de `GET /api/integration/ping` : ce qui permet au bouton « Tester » d'Onyx de dire qui répond. */
export function integrationPingPayload(version: string) {
  return { status: 'ok', service: 'onyxhub', version, features: ['availability-batch'] }
}

/** Réponse de `GET /api/media/availability/:id` : `{ status, available, seasons[] }`. */
export function availabilityPayload(availability: Availability) {
  return {
    status: availability.status,
    available: availability.available,
    seasons: availability.seasons.map((season) => ({
      seasonNumber: season.seasonNumber,
      status: season.status,
      available: season.available,
      totalEpisodes: season.totalEpisodes,
    })),
  }
}
