/**
 * Ce qu'OnyxHub lit d'un webhook Radarr ou Sonarr (Réglages → Connexions →
 * Webhook). Le reste de la charge — release, notes — sert aux notifications,
 * hors v1.
 */
export interface ArrEvent {
  mediaType: 'movie' | 'tv'
  eventType: string
  tmdbId?: number
  tvdbId?: number
  seasons?: number[]
  /**
   * Les fichiers importés, tels que Radarr/Sonarr les voient : Onyx les indexe
   * aussitôt quand ses montages sont les mêmes (ADR-0011).
   */
  paths?: string[]
}

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null

const positive = (value: unknown): number | undefined => (typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined)

const text = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value : undefined)

/** Le chemin d'un fichier : `path` (Radarr/Sonarr v4 et plus), sinon dossier + chemin relatif. */
function filePath(file: Record<string, unknown> | null, folder: string | undefined): string | undefined {
  const full = text(file?.path)
  if (full) return full
  const relative = text(file?.relativePath)
  return folder && relative ? `${folder.replace(/[\\/]+$/, '')}/${relative}` : undefined
}

/** `null` pour un événement sans média (`Test`, `Health`, `ApplicationUpdate`…). */
export function parseRadarrEvent(body: unknown): ArrEvent | null {
  const payload = record(body)
  const eventType = typeof payload?.eventType === 'string' ? payload.eventType : null
  const tmdbId = positive(record(payload?.movie)?.tmdbId) ?? positive(record(payload?.remoteMovie)?.tmdbId)
  if (!eventType || !tmdbId) return null
  const folder = text(record(payload?.movie)?.folderPath)
  const imported = filePath(record(payload?.movieFile), folder) ?? folder
  return { mediaType: 'movie', eventType, tmdbId, paths: imported ? [imported] : undefined }
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
  // Sonarr v4 range un lot d'épisodes dans `episodeFiles`, un seul dans `episodeFile`.
  const folder = text(series?.path)
  const files = [...(Array.isArray(payload?.episodeFiles) ? payload.episodeFiles : []), payload?.episodeFile]
  const imported = [...new Set(files.flatMap((file) => filePath(record(file), folder) ?? []))]
  return { mediaType: 'tv', eventType, tmdbId, tvdbId, seasons, paths: imported.length > 0 ? imported : undefined }
}

/** Un fichier vient d'être rangé (import, ou mise à niveau d'un fichier existant). */
export function isImport(event: ArrEvent): boolean {
  return event.eventType === 'Download'
}
