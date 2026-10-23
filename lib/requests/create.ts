import 'server-only'
import { randomUUID } from 'node:crypto'
import { errorMessage, NotConfiguredError, ServiceError } from '../http'
import { getRadarr } from '../services/arr/radarr'
import { getSonarr } from '../services/arr/sonarr'
import { getSorraa, sorraaConfigured } from '../services/sorraa/client'
import { getTmdb } from '../services/tmdb/client'
import type { MediaType, TmdbDetails } from '../services/tmdb/types'
import { seasonAvailability, seriesAvailability } from './availability'
import { formatSeasons } from './format'
import { invalidateLibrary } from './library'
import { insertMissing, type NewRequest } from './repository'
import { requestStatusFrom } from './status'

/**
 * Envoyer une demande : à Radarr ou Sonarr d'abord, puis une ligne par film
 * ou par saison dans la base. Utilisé par la fiche (server action) et par le
 * serveur Onyx (`POST /api/request`), qui reçoivent donc les mêmes messages.
 */
export interface RequestInput {
  mediaType: MediaType
  tmdbId: number
  /** Saisons voulues ; absent, toute la série (hors épisodes spéciaux), comme MediaHub. */
  seasons?: readonly number[]
  /** Repli si TMDB ne répond pas (le serveur Onyx les envoie). */
  title?: string
  posterPath?: string | null
}

/** Le compte Onyx qui demande : son nom, et son identifiant quand on le connaît (ADR-0012). */
export interface Requester {
  name: string
  id: number | null
}

export type RequestOutcome =
  | { ok: true; message: string; created: number }
  | { ok: false; status: 404 | 502 | 503; message: string }

async function tmdbDetails(type: MediaType, tmdbId: number): Promise<TmdbDetails | null> {
  try {
    return await getTmdb().details(type, tmdbId)
  } catch (error) {
    console.warn(`[demande] fiche TMDB ${type}/${tmdbId} : ${errorMessage(error)}`)
    return null
  }
}

function baseRow(input: RequestInput, details: TmdbDetails | null, requester: Requester, batchId: string, now: Date) {
  return {
    mediaType: input.mediaType,
    tmdbId: input.tmdbId,
    title: details?.title ?? details?.name ?? input.title?.trim() ?? 'Sans titre',
    posterPath: details?.poster_path ?? input.posterPath ?? null,
    requester: requester.name,
    requesterId: requester.id,
    batchId,
    requestedAt: now,
    updatedAt: now,
  }
}

async function requestMovie(input: RequestInput, requester: Requester): Promise<RequestOutcome> {
  const details = await tmdbDetails('movie', input.tmdbId)
  const outcome = await getRadarr().requestMovie(input.tmdbId)
  const base = baseRow(input, details, requester, randomUUID(), new Date())
  const created = insertMissing([
    { ...base, seasonNumber: null, tvdbId: null, status: outcome.kind === 'available' ? 'available' : 'approved' },
  ])
  const title = `« ${base.title} »`
  const message =
    outcome.kind === 'available'
      ? `${title} est déjà disponible.`
      : outcome.kind === 'already-requested'
        ? `${title} est déjà demandé.`
        : `${title} est demandé : Radarr le cherche.`
  return { ok: true, message, created: created.length }
}

async function requestShow(input: RequestInput, requester: Requester): Promise<RequestOutcome> {
  // Sans TMDB, pas d'identifiant TVDB : Sonarr ne saurait pas quelle série ajouter.
  const details = await getTmdb().details('tv', input.tmdbId)
  const tvdbId = details.external_ids?.tvdb_id
  if (!tvdbId) {
    return { ok: false, status: 404, message: 'TMDB ne donne pas l\'identifiant TVDB de cette série : Sonarr ne peut pas la trouver.' }
  }

  const wanted = input.seasons && input.seasons.length > 0 ? input.seasons : 'all'
  const outcome = await getSonarr().requestSeasons(tvdbId, wanted)
  const known = outcome.series.seasons.map((season) => season.seasonNumber)
  const seasons = (wanted === 'all' ? known.filter((number) => number > 0) : [...new Set(wanted)].filter((number) => known.includes(number))).sort(
    (a, b) => a - b,
  )

  const availability = seriesAvailability(outcome.series, new Set())
  const base = baseRow(input, details, requester, randomUUID(), new Date())
  const rows: NewRequest[] = seasons.map((seasonNumber) => ({
    ...base,
    seasonNumber,
    tvdbId,
    status: requestStatusFrom('approved', seasonAvailability(availability, seasonNumber)),
  }))
  const created = insertMissing(rows)

  const title = `« ${base.title} »`
  if (created.length === 0) {
    return { ok: true, message: seasons.length === 1 ? `Cette saison de ${title} est déjà demandée.` : `Ces saisons de ${title} sont déjà demandées.`, created: 0 }
  }
  const label = formatSeasons(created.map((row) => row.seasonNumber ?? 0))
  return { ok: true, message: `${label} de ${title} : demande envoyée, Sonarr cherche.`, created: created.length }
}

/**
 * Envoyer la demande à sorraa par son API : un film, une série entière ou
 * seulement quelques saisons. sorraa ajoute le titre, surveille ce qui est
 * demandé et lance la recherche ; OnyxHub garde une ligne par film ou par saison.
 */
async function requestViaSorraa(input: RequestInput, requester: Requester): Promise<RequestOutcome> {
  const details = await tmdbDetails(input.mediaType, input.tmdbId)
  const { request } = await getSorraa().createRequest({
    mediaType: input.mediaType,
    tmdbId: input.tmdbId,
    seasons: input.seasons,
    // L'identifiant du compte Onyx quand on le connaît : le nom peut changer.
    requester: { name: requester.name, ref: requester.id !== null ? String(requester.id) : requester.name },
  })
  const base = baseRow(input, details, requester, randomUUID(), new Date())
  const title = `« ${base.title} »`

  if (request.kind === 'movie') {
    const created = insertMissing([{ ...base, seasonNumber: null, tvdbId: null, status: requestStatusFrom('approved', request.state) }])
    return { ok: true, message: created.length === 0 ? `${title} est déjà demandé.` : `${title} est demandé : sorraa le cherche.`, created: created.length }
  }

  const tvdbId = details?.external_ids?.tvdb_id ?? null
  const created = insertMissing(
    (request.seasons ?? []).map((season) => ({
      ...base,
      seasonNumber: season.number,
      tvdbId,
      status: requestStatusFrom('approved', season.state),
    })),
  )
  if (created.length === 0) return { ok: true, message: `Ces saisons de ${title} sont déjà demandées.`, created: 0 }
  const label = formatSeasons(created.map((row) => row.seasonNumber ?? 0))
  return { ok: true, message: `${label} de ${title} : demande envoyée, sorraa cherche.`, created: created.length }
}

export async function createRequest(input: RequestInput, requesterName: string, requesterId: number | null = null): Promise<RequestOutcome> {
  const requester: Requester = { name: requesterName, id: requesterId }
  try {
    if (sorraaConfigured()) return await requestViaSorraa(input, requester)
    return input.mediaType === 'movie' ? await requestMovie(input, requester) : await requestShow(input, requester)
  } catch (error) {
    if (error instanceof NotConfiguredError) return { ok: false, status: 503, message: error.message }
    if (error instanceof ServiceError) return { ok: false, status: 502, message: error.message }
    throw error
  } finally {
    // Même un échec partiel (série ajoutée, recherche refusée) a pu changer la bibliothèque.
    invalidateLibrary()
  }
}
