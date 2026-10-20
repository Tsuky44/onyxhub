'use server'

import { revalidatePath } from 'next/cache'
import { getViewer } from '@/lib/auth/viewer'
import { errorMessage } from '@/lib/http'
import { loadCatalog, type CatalogPage, type CatalogSource } from '@/lib/requests/catalog'
import { createRequest } from '@/lib/requests/create'
import { parseDiscoverQuery } from '@/lib/requests/discover-query'
import { cleanMediaItem, isMediaType, isTmdbId } from '@/lib/requests/media-item'
import { setWatchLater } from '@/lib/requests/watch-later'
import { getTmdb } from '@/lib/services/tmdb/client'
import type { MediaType, TmdbWatchProvider } from '@/lib/services/tmdb/types'

/**
 * Les actions de la découverte et de la fiche. Chacune revérifie la session
 * et ses entrées : une server action est un point d'entrée HTTP comme un autre.
 */

/** Ce que la grille envoie pour demander la page suivante (la vue de découverte voyage sous forme d'URL). */
export type CatalogWire =
  | { kind: 'discover'; search: string }
  | { kind: 'related'; relation: 'similar' | 'recommendations'; mediaType: MediaType; tmdbId: number }


function toSource(wire: CatalogWire): CatalogSource | null {
  if (wire.kind === 'discover' && typeof wire.search === 'string') {
    return { kind: 'discover', query: parseDiscoverQuery(new URLSearchParams(wire.search)) }
  }
  if (wire.kind === 'related' && (wire.relation === 'similar' || wire.relation === 'recommendations') && isMediaType(wire.mediaType) && isTmdbId(wire.tmdbId)) {
    return { kind: 'related', relation: wire.relation, mediaType: wire.mediaType, tmdbId: wire.tmdbId }
  }
  return null
}

export async function loadCatalogPage(wire: CatalogWire, page: number): Promise<{ ok: true; page: CatalogPage } | { ok: false; message: string }> {
  const viewer = await getViewer()
  const source = toSource(wire)
  if (!source) return { ok: false, message: 'Vue inconnue.' }
  try {
    return { ok: true, page: await loadCatalog(source, page, viewer) }
  } catch (error) {
    return { ok: false, message: errorMessage(error) }
  }
}

export async function loadWatchProviders(mediaType: MediaType | 'all', region: string): Promise<TmdbWatchProvider[]> {
  await getViewer()
  if (!/^[A-Z]{2}$/.test(region)) return []
  const tmdb = getTmdb()
  try {
    if (mediaType !== 'all') return (await tmdb.watchProviders(mediaType, region)).slice(0, 40)
    const [movies, shows] = await Promise.all([tmdb.watchProviders('movie', region), tmdb.watchProviders('tv', region)])
    const merged = new Map([...movies, ...shows].map((provider) => [provider.provider_id, provider]))
    return [...merged.values()].sort((a, b) => (a.display_priority ?? 999) - (b.display_priority ?? 999)).slice(0, 40)
  } catch {
    // Les plateformes ne sont qu'un filtre : sans elles, le reste du panneau fonctionne.
    return []
  }
}

export type RequestActionResult = { ok: boolean; message: string }

export async function requestMediaAction(mediaType: MediaType, tmdbId: number, seasons?: number[]): Promise<RequestActionResult> {
  const viewer = await getViewer()
  if (!viewer.canRequest) return { ok: false, message: 'Ton compte Onyx n\'a pas le droit de demander des médias.' }
  if (!isMediaType(mediaType) || !isTmdbId(tmdbId)) return { ok: false, message: 'Média inconnu.' }
  const cleanSeasons = Array.isArray(seasons) ? seasons.filter((season) => Number.isInteger(season) && season >= 0) : undefined
  if (mediaType === 'tv' && Array.isArray(seasons) && cleanSeasons?.length === 0) return { ok: false, message: 'Choisis au moins une saison.' }

  const outcome = await createRequest({ mediaType, tmdbId, seasons: cleanSeasons }, viewer.name)
  revalidatePath('/demandes', 'layout')
  return { ok: outcome.ok, message: outcome.message }
}

export async function setWatchLaterAction(
  item: { mediaType: MediaType; tmdbId: number; title: string; posterPath: string | null },
  wanted: boolean,
): Promise<boolean> {
  const viewer = await getViewer()
  const media = cleanMediaItem(item)
  if (!media) return !wanted
  try {
    const result = await setWatchLater(viewer, media, wanted === true)
    revalidatePath('/demandes')
    return result
  } catch (error) {
    // Onyx a refusé ou ne répond pas : le bouton garde son état d'avant.
    console.warn(`[plus tard] ${media.mediaType}/${media.tmdbId} : ${errorMessage(error)}`)
    return !wanted
  }
}
