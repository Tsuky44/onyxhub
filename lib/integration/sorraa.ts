import type { MediaRequestRow } from '../db/schema'
import type { DownloadProgress } from '../requests/downloads'
import { statusFromSorraaAndOnyx } from '../requests/sorraa-status'
import type { AvailabilityStatus, RequestStatus } from '../requests/status'
import type { ArrEvent } from '../requests/webhook-payload'
import type { MediaType } from '../services/tmdb/types'

/**
 * Ce que sorraa dit à OnyxHub par son API (ADR 0021 de sorraa) : les
 * événements de l'historique, dans l'ordre, et l'avancement des
 * téléchargements en cours, en entier à chaque envoi.
 */
export interface SorraaEvent {
  id: number
  event: string
  mediaType: MediaType
  tmdbId: number
  season?: number
  /** L'état des demandes du média après l'événement, tel que sorraa le calcule. */
  requests: { state: AvailabilityStatus; seasons: { number: number; state: AvailabilityStatus }[] }[]
  /** Pour un import : où est le fichier. */
  message?: string
}

export interface SorraaDownload {
  mediaType: MediaType
  tmdbId: number
  season: number | null
  release: string
  state: string
  /** 0 à 1. */
  progress: number
  size: number
  left: number
  speed: number
  eta: number | null
}

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null

const positive = (value: unknown): number | undefined => (typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined)

const count = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0)

const STATES = new Set<string>(['pending', 'processing', 'partial', 'available'])
const stateOf = (value: unknown): AvailabilityStatus => (typeof value === 'string' && STATES.has(value) ? (value as AvailabilityStatus) : 'unknown')

function mediaTypeOf(value: unknown): MediaType | null {
  return value === 'movie' ? 'movie' : value === 'series' ? 'tv' : null
}

/** Les événements d'un lot reçu ; ce qui n'est pas un événement d'un média est écarté. */
export function parseSorraaEvents(body: unknown): SorraaEvent[] {
  const events = record(body)?.events
  if (!Array.isArray(events)) return []
  return events.flatMap((raw): SorraaEvent[] => {
    const payload = record(raw)
    const media = record(payload?.media)
    const mediaType = mediaTypeOf(media?.kind)
    const tmdbId = positive(media?.tmdbId)
    const id = positive(payload?.id)
    if (!payload || !id || !mediaType || !tmdbId || typeof payload.event !== 'string') return []
    const requests = (Array.isArray(payload.requests) ? payload.requests : []).flatMap((entry) => {
      const request = record(entry)
      if (!request) return []
      const seasons = (Array.isArray(request.seasons) ? request.seasons : []).flatMap((item) => {
        const season = record(item)
        const number = positive(season?.number)
        return number ? [{ number, state: stateOf(season?.state) }] : []
      })
      return [{ state: stateOf(request.state), seasons }]
    })
    const season = positive(record(payload.unit)?.season)
    const message = typeof payload.message === 'string' && payload.message ? payload.message : undefined
    return [{ id, event: payload.event, mediaType, tmdbId, season, requests, message }]
  })
}

/**
 * Les nouveaux statuts des demandes d'un média d'après un événement de
 * sorraa. Pure. Une ligne d'une saison suit l'état de cette saison, une ligne
 * du média entier l'état de la demande ; sans état, rien ne bouge.
 */
export function statusChangesFromSorraa(rows: readonly MediaRequestRow[], event: SorraaEvent): Map<number, RequestStatus> {
  const changes = new Map<number, RequestStatus>()
  const request = event.requests[0]
  if (!request) return changes
  for (const row of rows) {
    const availability = row.seasonNumber === null ? request.state : request.seasons.find((season) => season.number === row.seasonNumber)?.state
    // Une saison que la demande de sorraa ne couvre pas n'est pas son affaire.
    if (!availability) continue
    // Sans session, Onyx ne peut pas confirmer : « disponible » attend son index.
    const next = statusFromSorraaAndOnyx(row.status, row.seasonNumber === null, availability, null)
    if (next !== row.status) changes.set(row.id, next)
  }
  return changes
}

/** L'événement vu comme un événement *arr, pour l'annonce d'import à Onyx. */
export function asArrEvent(event: SorraaEvent): ArrEvent | null {
  if (event.event !== 'imported' && event.event !== 'upgraded') return null
  // Seul un chemin complet sert à Onyx ; sorraa peut ne dire que le nom du fichier.
  const absolute = event.message && (event.message.startsWith('/') || /^[A-Za-z]:[\\/]/.test(event.message))
  return {
    mediaType: event.mediaType,
    eventType: 'Download',
    tmdbId: event.tmdbId,
    seasons: event.season ? [event.season] : undefined,
    paths: absolute ? [event.message as string] : undefined,
  }
}

/** Les téléchargements d'un rapport reçu. */
export function parseSorraaDownloads(body: unknown): SorraaDownload[] {
  const downloads = record(body)?.downloads
  if (!Array.isArray(downloads)) return []
  return downloads.flatMap((raw): SorraaDownload[] => {
    const item = record(raw)
    const media = record(item?.media)
    const mediaType = mediaTypeOf(media?.kind)
    const tmdbId = positive(media?.tmdbId)
    if (!item || !mediaType || !tmdbId) return []
    return [
      {
        mediaType,
        tmdbId,
        season: positive(item.season) ?? null,
        release: typeof item.release === 'string' ? item.release : '',
        state: typeof item.state === 'string' ? item.state : '',
        progress: Math.min(1, count(item.progress)),
        size: count(item.size),
        left: count(item.left),
        speed: count(item.speed),
        eta: positive(item.eta) ?? null,
      },
    ]
  })
}

const STALLED = new Set(['paused', 'stalled'])

/** Un téléchargement tel que la fiche d'un média l'affiche. */
export function toDownloadProgress(download: SorraaDownload): DownloadProgress {
  return {
    title: download.release,
    seasonNumber: download.season,
    progress: Math.round(download.progress * 1000) / 10,
    size: download.size,
    sizeLeft: download.left,
    speed: download.speed,
    eta: download.eta,
    stalled: STALLED.has(download.state),
  }
}
