/**
 * Ce qu'OnyxHub lit d'un webhook Radarr ou Sonarr (Réglages → Connexions →
 * Webhook). Le reste de la charge — release, fichiers, notes — sert aux
 * notifications, hors v1.
 */
export interface ArrEvent {
  mediaType: 'movie' | 'tv'
  eventType: string
  tmdbId?: number
  tvdbId?: number
  seasons?: number[]
}

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null

const positive = (value: unknown): number | undefined => (typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined)

/** `null` pour un événement sans média (`Test`, `Health`, `ApplicationUpdate`…). */
export function parseRadarrEvent(body: unknown): ArrEvent | null {
  const payload = record(body)
  const eventType = typeof payload?.eventType === 'string' ? payload.eventType : null
  const tmdbId = positive(record(payload?.movie)?.tmdbId) ?? positive(record(payload?.remoteMovie)?.tmdbId)
  if (!eventType || !tmdbId) return null
  return { mediaType: 'movie', eventType, tmdbId }
}

export function parseSonarrEvent(body: unknown): ArrEvent | null {
  const payload = record(body)
  const eventType = typeof payload?.eventType === 'string' ? payload.eventType : null
  const series = record(payload?.series)
  const tvdbId = positive(series?.tvdbId)
  const tmdbId = positive(series?.tmdbId)
  if (!eventType || (!tvdbId && !tmdbId)) return null
  const episodes = Array.isArray(payload?.episodes) ? payload.episodes : []
  const seasons = [...new Set(episodes.flatMap((episode) => {
    const number = record(episode)?.seasonNumber
    return typeof number === 'number' && Number.isInteger(number) ? [number] : []
  }))]
  return { mediaType: 'tv', eventType, tmdbId, tvdbId, seasons }
}
