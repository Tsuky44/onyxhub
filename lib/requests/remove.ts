import 'server-only'
import type { MediaRequestRow } from '../db/schema'
import { errorMessage, NotConfiguredError } from '../http'
import { getRadarr } from '../services/arr/radarr'
import { getSonarr } from '../services/arr/sonarr'
import { getSorraa, sorraaConfigured } from '../services/sorraa/client'
import { getTmdb } from '../services/tmdb/client'
import type { MediaType } from '../services/tmdb/types'
import { invalidateLibrary } from './library'
import { deleteMediaRows, deleteRequestRows, deleteSeasonRows, requestsByIds, requestsForMedia, setMediaStatus } from './repository'

/**
 * Supprimer des demandes, avec le ménage de MediaHub côté Radarr/Sonarr :
 *
 * - une saison que plus personne ne demande cesse d'être surveillée ;
 * - une série sans saison surveillée ni fichier, ou un film sans fichier,
 *   quitte la bibliothèque (sans toucher aux fichiers) ;
 * - un film déjà téléchargé reste, simplement plus surveillé.
 *
 * Une erreur de Radarr/Sonarr n'empêche pas de supprimer la demande : elle
 * remonte en avertissement, comme MediaHub la journalisait.
 */
export interface RemovalReport {
  deleted: number
  warnings: string[]
}

function groupByMedia(rows: readonly MediaRequestRow[]): MediaRequestRow[][] {
  const groups = new Map<string, MediaRequestRow[]>()
  for (const row of rows) {
    const key = `${row.mediaType}:${row.tmdbId}`
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  return [...groups.values()]
}

async function tvdbIdOf(rows: readonly MediaRequestRow[], tmdbId: number): Promise<number | null> {
  const known = rows.find((row) => row.tvdbId)?.tvdbId
  if (known) return known
  return (await getTmdb().externalIds('tv', tmdbId)).tvdb_id ?? null
}

async function cleanUpShow(group: readonly MediaRequestRow[], remaining: readonly MediaRequestRow[]): Promise<void> {
  const sonarr = getSonarr()
  const tvdbId = await tvdbIdOf(group, group[0]!.tmdbId)
  if (!tvdbId) return
  const series = await sonarr.seriesByTvdbId(tvdbId)
  if (!series?.id) return

  const stillWanted = new Set(remaining.map((row) => row.seasonNumber))
  const dropped = group.flatMap((row) => (row.seasonNumber !== null && !stillWanted.has(row.seasonNumber) ? [row.seasonNumber] : []))
  const updated = dropped.length > 0 ? await sonarr.setSeasonsMonitored(series.id, dropped, false) : series

  const monitored = updated.seasons.some((season) => season.seasonNumber > 0 && season.monitored)
  const files = updated.statistics?.episodeFileCount ?? series.statistics?.episodeFileCount ?? 0
  if (remaining.length === 0 && !monitored && files === 0) await sonarr.deleteSeries(series.id, false)
}

async function cleanUpMovie(tmdbId: number): Promise<void> {
  const radarr = getRadarr()
  const movie = await radarr.movieByTmdbId(tmdbId)
  if (!movie?.id) return
  if (movie.hasFile) await radarr.setMonitored(movie.id, false)
  else await radarr.deleteMovie(movie.id, false)
}

/**
 * Chez sorraa, retirer des demandes arrête la recherche de ce que plus
 * personne ne demande (le film, ou les saisons retirées) ; le média et ses
 * fichiers restent. Pour tout retirer, voir `removeMedia` et `removeSeason`.
 */
async function stopSearchingInSorraa(group: readonly MediaRequestRow[], remaining: readonly MediaRequestRow[]): Promise<void> {
  const first = group[0]!
  const sorraa = getSorraa()
  const requests = await sorraa.requestsFor(first.mediaType, first.tmdbId)
  const stillWanted = new Set(remaining.map((row) => row.seasonNumber))
  const dropped = group.flatMap((row) => (row.seasonNumber !== null && !stillWanted.has(row.seasonNumber) ? [row.seasonNumber] : []))

  for (const request of requests) {
    if (first.mediaType === 'movie') {
      if (remaining.length === 0) await sorraa.withdraw(request.id, { stopSearching: true })
      continue
    }
    const seasons = (request.seasons ?? []).map((season) => season.number).filter((number) => dropped.includes(number))
    if (seasons.length > 0) await sorraa.withdraw(request.id, { seasons, stopSearching: true })
  }
}

export async function removeRequests(ids: readonly number[]): Promise<RemovalReport> {
  const rows = requestsByIds(ids)
  const deleting = new Set(rows.map((row) => row.id))
  const warnings: string[] = []

  for (const group of groupByMedia(rows)) {
    const first = group[0]!
    const remaining = requestsForMedia(first.mediaType, first.tmdbId).filter((row) => !deleting.has(row.id))
    try {
      if (sorraaConfigured()) await stopSearchingInSorraa(group, remaining)
      else if (first.mediaType === 'tv') await cleanUpShow(group, remaining)
      else if (remaining.length === 0) await cleanUpMovie(first.tmdbId)
    } catch (error) {
      warnings.push(`« ${first.title} » : ${errorMessage(error)}`)
    }
    deleteRequestRows(group.map((row) => row.id))
  }

  invalidateLibrary()
  return { deleted: rows.length, warnings }
}

/** Retire un média de Radarr/Sonarr (fichiers compris si demandé) et efface ses demandes. Réservé à l'admin. */
export async function removeMedia(mediaType: MediaType, tmdbId: number, deleteFiles: boolean): Promise<void> {
  try {
    if (sorraaConfigured()) {
      const sorraa = getSorraa()
      const mediaId = await sorraa.mediaId(mediaType, tmdbId)
      if (mediaId !== null) await sorraa.removeMedia(mediaId, deleteFiles)
    } else if (mediaType === 'movie') {
      const radarr = getRadarr()
      const movie = await radarr.movieByTmdbId(tmdbId)
      if (movie?.id) await radarr.deleteMovie(movie.id, deleteFiles)
    } else {
      const sonarr = getSonarr()
      const tvdbId = await tvdbIdOf(requestsForMedia('tv', tmdbId), tmdbId)
      const series = tvdbId ? await sonarr.seriesByTvdbId(tvdbId) : null
      if (series?.id) await sonarr.deleteSeries(series.id, deleteFiles)
    }
    deleteMediaRows(mediaType, tmdbId)
  } finally {
    invalidateLibrary()
  }
}

/**
 * Retire complètement une saison chez sorraa : plus cherchée, retirée des
 * demandes, et ses fichiers à la corbeille avec `deleteFiles`. La série et
 * ses autres saisons restent. Réservé à l'admin.
 */
export async function removeSeason(tmdbId: number, seasonNumber: number, deleteFiles: boolean): Promise<void> {
  if (!sorraaConfigured()) throw new NotConfiguredError('sorraa')
  const sorraa = getSorraa()
  const mediaId = await sorraa.mediaId('tv', tmdbId)
  if (mediaId !== null) await sorraa.removeSeason(mediaId, seasonNumber, deleteFiles)
  deleteSeasonRows(tmdbId, seasonNumber)
}

/** « Marquer comme disponible » (MediaHub : `POST /api/media/:id/manage?action=status`). */
export function markAvailable(mediaType: MediaType, tmdbId: number): void {
  setMediaStatus(mediaType, tmdbId, 'available')
}
