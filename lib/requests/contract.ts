import type { Availability } from './availability'
import type { RequestInput } from './create'

/**
 * Les deux formats que le serveur Onyx connaît (ADR-0002), repris de
 * MediaHub à l'identique. `server/handlers/mediahub.go` dans Onyx les lit :
 * les changer impose de changer Onyx dans le même mouvement.
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
