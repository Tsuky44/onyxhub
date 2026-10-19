'use server'

import { revalidatePath } from 'next/cache'
import { getViewer, type Viewer } from '@/lib/auth/viewer'
import { errorMessage } from '@/lib/http'
import { mediaDownloads, type DownloadProgress } from '@/lib/requests/downloads'
import { mediaHref } from '@/lib/requests/format'
import { automaticSearch, grabRelease, searchReleases, seasonEpisodes, type SeasonEpisode } from '@/lib/requests/media-tools'
import { markAvailable, removeMedia } from '@/lib/requests/remove'
import type { ArrRelease } from '@/lib/services/arr/types'
import type { MediaType } from '@/lib/services/tmdb/types'

/** Les actions de la fiche. Les outils Radarr/Sonarr sont réservés à l'admin, revérifié à chaque appel. */

type Result<T> = { ok: true; value: T } | { ok: false; message: string }

const isMediaType = (value: unknown): value is MediaType => value === 'movie' || value === 'tv'
const isId = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0
const optionalId = (value: unknown): number | null => (isId(value) ? value : null)

async function attempt<T>(run: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, value: await run() }
  } catch (error) {
    return { ok: false, message: errorMessage(error) }
  }
}

async function admin(): Promise<Viewer | null> {
  const viewer = await getViewer()
  return viewer.isAdmin ? viewer : null
}

const FORBIDDEN = { ok: false, message: 'Réservé aux administrateurs.' } as const

export async function loadSeasonAction(tmdbId: number, seasonNumber: number, tvdbId: number | null): Promise<Result<SeasonEpisode[]>> {
  await getViewer()
  if (!isId(tmdbId) || !Number.isInteger(seasonNumber) || seasonNumber < 0) return { ok: false, message: 'Saison inconnue.' }
  return attempt(() => seasonEpisodes(tmdbId, seasonNumber, optionalId(tvdbId)))
}

export async function downloadsAction(mediaType: MediaType, tmdbId: number, tvdbId: number | null): Promise<DownloadProgress[]> {
  await getViewer()
  if (!isMediaType(mediaType) || !isId(tmdbId)) return []
  try {
    return await mediaDownloads(mediaType, tmdbId, optionalId(tvdbId))
  } catch {
    // La progression est un bonus : une panne de qBit ou de l'*arr ne casse pas la fiche.
    return []
  }
}

export async function automaticSearchAction(mediaType: MediaType, tmdbId: number, seasonNumber: number | null, tvdbId: number | null): Promise<Result<string>> {
  if (!(await admin())) return FORBIDDEN
  if (!isMediaType(mediaType) || !isId(tmdbId)) return { ok: false, message: 'Média inconnu.' }
  const season = seasonNumber !== null && Number.isInteger(seasonNumber) && seasonNumber >= 0 ? seasonNumber : undefined
  return attempt(async () => {
    await automaticSearch(mediaType, tmdbId, season, optionalId(tvdbId))
    return 'Recherche automatique lancée.'
  })
}

export async function searchReleasesAction(
  mediaType: MediaType,
  tmdbId: number,
  scope: { seasonNumber?: number; episodeId?: number },
  tvdbId: number | null,
): Promise<Result<ArrRelease[]>> {
  if (!(await admin())) return FORBIDDEN
  if (!isMediaType(mediaType) || !isId(tmdbId)) return { ok: false, message: 'Média inconnu.' }
  const clean = {
    seasonNumber: Number.isInteger(scope?.seasonNumber) && (scope.seasonNumber ?? -1) >= 0 ? scope.seasonNumber : undefined,
    episodeId: isId(scope?.episodeId) ? scope.episodeId : undefined,
  }
  return attempt(() => searchReleases(mediaType, tmdbId, clean, optionalId(tvdbId)))
}

export async function grabReleaseAction(mediaType: MediaType, guid: string, indexerId: number): Promise<Result<string>> {
  if (!(await admin())) return FORBIDDEN
  if (!isMediaType(mediaType) || typeof guid !== 'string' || !guid || !Number.isInteger(indexerId)) return { ok: false, message: 'Release inconnue.' }
  return attempt(async () => {
    await grabRelease(mediaType, { guid, indexerId })
    return 'Release envoyée au client de téléchargement.'
  })
}

export async function removeMediaAction(mediaType: MediaType, tmdbId: number, deleteFiles: boolean): Promise<Result<string>> {
  if (!(await admin())) return FORBIDDEN
  if (!isMediaType(mediaType) || !isId(tmdbId)) return { ok: false, message: 'Média inconnu.' }
  const result = await attempt(async () => {
    await removeMedia(mediaType, tmdbId, deleteFiles === true)
    return deleteFiles ? 'Média et fichiers supprimés.' : 'Média retiré de la bibliothèque, fichiers conservés.'
  })
  revalidatePath(mediaHref(mediaType, tmdbId))
  revalidatePath('/demandes/liste')
  return result
}

export async function markAvailableAction(mediaType: MediaType, tmdbId: number): Promise<Result<string>> {
  if (!(await admin())) return FORBIDDEN
  if (!isMediaType(mediaType) || !isId(tmdbId)) return { ok: false, message: 'Média inconnu.' }
  markAvailable(mediaType, tmdbId)
  revalidatePath(mediaHref(mediaType, tmdbId))
  revalidatePath('/demandes/liste')
  return { ok: true, value: 'Demandes marquées disponibles.' }
}
