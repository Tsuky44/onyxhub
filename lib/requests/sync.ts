import 'server-only'
import { randomUUID } from 'node:crypto'
import type { MediaRequestRow } from '../db/schema'
import { errorMessage, NotConfiguredError } from '../http'
import { getRadarr } from '../services/arr/radarr'
import { getSonarr } from '../services/arr/sonarr'
import type { ArrImage, RadarrMovie, SonarrSeries } from '../services/arr/types'
import { getTmdb } from '../services/tmdb/client'
import { seasonAvailability } from './availability'
import { availabilityIn, getLibrary, invalidateLibrary, type LibraryIndex } from './library'
import { insertMissing, openRequests, requestsByTvdb, requestsForMedia, updateStatuses, type NewRequest } from './repository'
import { requestStatusFrom, type RequestStatus } from './status'

/** Le demandeur des demandes importées depuis Radarr/Sonarr, comme « Imported » dans MediaHub. */
export const IMPORTED_REQUESTER = 'Importé'

/** Les nouveaux statuts de quelques demandes d'après l'index de bibliothèque. Pure. */
export function statusChanges(rows: readonly MediaRequestRow[], index: LibraryIndex): Map<number, RequestStatus> {
  const changes = new Map<number, RequestStatus>()
  for (const row of rows) {
    // Un service non configuré ne dit rien : on ne touche pas aux demandes qu'il porte.
    if (row.mediaType === 'movie' ? !index.radarr : !index.sonarr) continue
    const availability = availabilityIn(index, row.mediaType, row.tmdbId, row.tvdbId)
    const next = requestStatusFrom(row.status, seasonAvailability(availability, row.seasonNumber))
    if (next !== row.status) changes.set(row.id, next)
  }
  return changes
}

/** Fait avancer les demandes ouvertes (ou celles données). Renvoie le nombre de demandes changées. */
export async function refreshStatuses(rows: readonly MediaRequestRow[] = openRequests()): Promise<number> {
  if (rows.length === 0) return 0
  const changes = statusChanges(rows, await getLibrary())
  updateStatuses(changes)
  return changes.size
}

/**
 * Un webhook Radarr/Sonarr : la bibliothèque a changé pour ce média. À la
 * saisie d'une release (`Grab`), la file de l'*arr ne la montre pas toujours
 * tout de suite : on passe directement les demandes concernées « en cours ».
 */
export async function onArrEvent(event: {
  mediaType: 'movie' | 'tv'
  eventType: string
  tmdbId?: number
  tvdbId?: number
  seasons?: readonly number[]
}): Promise<number> {
  const rows = [
    ...(event.tmdbId ? requestsForMedia(event.mediaType, event.tmdbId) : []),
    ...(event.mediaType === 'tv' && event.tvdbId ? requestsByTvdb(event.tvdbId) : []),
  ].filter((row, index, all) => all.findIndex((other) => other.id === row.id) === index)
  if (rows.length === 0) return 0

  if (event.eventType === 'Grab') {
    const seasons = new Set(event.seasons ?? [])
    const changes = new Map<number, RequestStatus>()
    for (const row of rows) {
      const concerned = row.seasonNumber === null || seasons.size === 0 || seasons.has(row.seasonNumber)
      if (concerned && row.status !== 'available' && row.status !== 'partial') changes.set(row.id, 'processing')
    }
    updateStatuses(changes)
    invalidateLibrary()
    return changes.size
  }

  invalidateLibrary()
  return refreshStatuses(rows)
}

// --- Import depuis Radarr/Sonarr (bouton « Synchroniser » de l'admin) ---

/** Le chemin TMDB d'une image *arr (`…/t/p/original/abc.jpg` → `/abc.jpg`), sinon `null`. */
export function tmdbPosterPath(images: readonly ArrImage[] | undefined): string | null {
  const poster = images?.find((image) => image.coverType === 'poster')
  const match = poster?.remoteUrl?.match(/image\.tmdb\.org\/t\/p\/[^/]+(\/[^/?]+)/)
  return match?.[1] ?? null
}

/** Exécute `task` sur chaque élément, `limit` à la fois : un import de 500 séries ne lance pas 500 appels TMDB d'un coup. */
async function eachLimited<T>(items: readonly T[], limit: number, task: (item: T) => Promise<void>): Promise<void> {
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await task(items[next++]!)
  })
  await Promise.all(workers)
}

function importedRow(fields: Pick<NewRequest, 'mediaType' | 'tmdbId' | 'title' | 'posterPath'>, batchId: string, added: string | undefined): Omit<NewRequest, 'seasonNumber' | 'tvdbId'> {
  const requestedAt = added ? new Date(added) : new Date()
  return { ...fields, status: 'pending', requester: IMPORTED_REQUESTER, batchId, requestedAt, updatedAt: new Date() }
}

async function importMovies(movies: readonly RadarrMovie[]): Promise<number> {
  let created = 0
  for (const movie of movies) {
    if (!movie.monitored || movie.hasFile || !movie.tmdbId) continue
    const row = importedRow(
      { mediaType: 'movie', tmdbId: movie.tmdbId, title: movie.title, posterPath: tmdbPosterPath(movie.images) },
      randomUUID(),
      movie.added,
    )
    created += insertMissing([{ ...row, seasonNumber: null, tvdbId: null }]).length
  }
  return created
}

async function importSeries(series: readonly SonarrSeries[]): Promise<{ created: number; skipped: number }> {
  let created = 0
  let skipped = 0
  const tmdb = getTmdb()
  const missing = series.filter((show) => show.seasons.some((season) => season.seasonNumber > 0 && season.monitored && (season.statistics?.percentOfEpisodes ?? 0) < 100))
  await eachLimited(missing, 4, async (show) => {
    // Sonarr v3 ne donne pas l'identifiant TMDB : TMDB le retrouve par l'identifiant TVDB.
    const found = show.tmdbId ? null : await tmdb.findByTvdb(show.tvdbId).catch(() => null)
    const tmdbId = show.tmdbId ?? found?.id
    if (!tmdbId) {
      skipped++
      return
    }
    // Les affiches Sonarr viennent de TVDB : on garde celle de TMDB, que les pages savent afficher.
    const posterPath = found?.poster_path ?? (await tmdb.details('tv', tmdbId).catch(() => null))?.poster_path ?? null
    const base = importedRow({ mediaType: 'tv', tmdbId, title: show.title, posterPath }, randomUUID(), undefined)
    const seasons = show.seasons.filter((season) => season.seasonNumber > 0 && season.monitored && (season.statistics?.percentOfEpisodes ?? 0) < 100)
    created += insertMissing(seasons.map((season) => ({ ...base, seasonNumber: season.seasonNumber, tvdbId: show.tvdbId }))).length
  })
  return { created, skipped }
}

export interface ImportReport {
  imported: number
  updated: number
  warnings: string[]
}

/**
 * Importe comme demandes « en attente » ce que Radarr et Sonarr surveillent
 * sans l'avoir encore (films sans fichier, saisons incomplètes), puis met à
 * jour tous les statuts. Ce que l'*arr a déjà en entier n'est pas importé.
 */
export async function importFromArr(): Promise<ImportReport> {
  const warnings: string[] = []
  let imported = 0
  const attempt = async (service: string, run: () => Promise<void>) => {
    try {
      await run()
    } catch (error) {
      if (!(error instanceof NotConfiguredError)) warnings.push(`${service} : ${errorMessage(error)}`)
    }
  }
  await attempt('Radarr', async () => {
    imported += await importMovies(await getRadarr().movies())
  })
  await attempt('Sonarr', async () => {
    const result = await importSeries(await getSonarr().allSeries())
    imported += result.created
    if (result.skipped > 0) warnings.push(`${result.skipped} série(s) sans identifiant TMDB ignorée(s).`)
  })
  invalidateLibrary()
  const updated = await refreshStatuses()
  return { imported, updated, warnings }
}
