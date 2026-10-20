import 'server-only'
import type { Viewer } from '../auth/permissions'
import { getTmdb } from '../services/tmdb/client'
import type { MediaType, Paged, TmdbSummary } from '../services/tmdb/types'
import { activeFilterCount, type DiscoverQuery } from './discover-query'
import { yearOf } from './format'
import { getLibrary } from './library'
import { availabilityMap } from './media-availability'
import { onyxLibrary, onyxMediaId, withOnyxPresence } from './onyx-presence'
import { recentRequestsOf } from './repository'
import type { AvailabilityStatus } from './status'
import { listWatchLater } from './watch-later'

/**
 * Les grilles de médias (découverte, « pour toi », similaires…) : une page
 * TMDB et le statut de chaque carte, lu dans l'index de bibliothèque sans
 * aucun appel par carte.
 */
export interface CatalogItem {
  mediaType: MediaType
  tmdbId: number
  title: string
  year: string | null
  posterPath: string | null
  rating: number | null
  status: AvailabilityStatus
}

export interface CatalogPage {
  items: CatalogItem[]
  page: number
  hasMore: boolean
}

export type CatalogSource =
  | { kind: 'discover'; query: DiscoverQuery }
  | { kind: 'related'; relation: 'similar' | 'recommendations'; mediaType: MediaType; tmdbId: number }

/** TMDB refuse d'aller au-delà de la page 500. */
const MAX_PAGE = 500
/** « Pour toi » mélange les recommandations de tes dernières demandes : au-delà de 10 pages, ça ne veut plus rien dire. */
const MAX_RECOMMENDATION_PAGES = 10
const RECOMMENDATION_SEEDS = 5

type Card = Omit<CatalogItem, 'status'>

function toCard(item: TmdbSummary, fallbackType?: MediaType): Card | null {
  const mediaType = item.media_type === 'movie' || item.media_type === 'tv' ? item.media_type : fallbackType
  if (!mediaType) return null
  return {
    mediaType,
    tmdbId: item.id,
    title: item.title ?? item.name ?? 'Sans titre',
    year: yearOf(item.release_date ?? item.first_air_date),
    posterPath: item.poster_path,
    rating: item.vote_average ? Math.round(item.vote_average * 10) / 10 : null,
  }
}

/** Les cartes d'une liste TMDB, avec leur statut. Les doublons (même média sur deux pages fusionnées) disparaissent. */
export async function withStatus(items: readonly TmdbSummary[], fallbackType?: MediaType): Promise<CatalogItem[]> {
  const seen = new Set<string>()
  const cards = items.flatMap((item) => {
    const card = toCard(item, fallbackType)
    const key = card && `${card.mediaType}:${card.tmdbId}`
    if (!card || !key || seen.has(key)) return []
    seen.add(key)
    return [card]
  })
  const [library, onyx] = await Promise.all([getLibrary(), onyxLibrary()])
  const statuses = availabilityMap(library, cards)
  return cards.map((card) => ({
    ...card,
    status: withOnyxPresence(statuses.get(`${card.mediaType}:${card.tmdbId}`)?.status ?? 'unknown', onyxMediaId(onyx, card.mediaType, card.tmdbId) !== null),
  }))
}

async function fromPaged(paged: Paged<TmdbSummary>, page: number, fallbackType?: MediaType, maxPage = MAX_PAGE): Promise<CatalogPage> {
  return { items: await withStatus(paged.results, fallbackType), page, hasMore: page < Math.min(paged.total_pages, maxPage) }
}

/** Les recommandations de tes dernières demandes, alternées pour qu'aucune ne domine ; les tendances sans demande. */
async function forYou(viewer: Viewer, page: number): Promise<CatalogPage> {
  const tmdb = getTmdb()
  const seeds = recentRequestsOf(viewer.name, 40)
    .filter((row, index, all) => all.findIndex((other) => other.mediaType === row.mediaType && other.tmdbId === row.tmdbId) === index)
    .slice(0, RECOMMENDATION_SEEDS)
  if (seeds.length === 0) return fromPaged(await tmdb.trending('all', page), page)

  const lists = await Promise.all(seeds.map((seed) => tmdb.recommendations(seed.mediaType, seed.tmdbId, page).catch(() => null)))
  const pages = lists.filter((list): list is Paged<TmdbSummary> => list !== null)
  const longest = Math.max(0, ...pages.map((list) => list.results.length))
  const interleaved: TmdbSummary[] = []
  for (let position = 0; position < longest; position++) {
    for (const list of pages) {
      const item = list.results[position]
      if (item) interleaved.push(item)
    }
  }
  // Ce que tu as déjà demandé n'a rien à faire dans tes recommandations.
  const requested = new Set(seeds.map((seed) => `${seed.mediaType}:${seed.tmdbId}`))
  const items = (await withStatus(interleaved)).filter((item) => !requested.has(`${item.mediaType}:${item.tmdbId}`))
  const totalPages = Math.max(0, ...pages.map((list) => list.total_pages))
  return { items, page, hasMore: page < Math.min(totalPages, MAX_RECOMMENDATION_PAGES) }
}

async function watchLaterPage(viewer: Viewer): Promise<CatalogPage> {
  const saved = await listWatchLater(viewer)
  const [library, onyx] = await Promise.all([getLibrary(), onyxLibrary()])
  const statuses = availabilityMap(library, saved)
  return {
    items: saved.map((item) => ({
      ...item,
      year: null,
      rating: null,
      status: withOnyxPresence(statuses.get(`${item.mediaType}:${item.tmdbId}`)?.status ?? 'unknown', onyxMediaId(onyx, item.mediaType, item.tmdbId) !== null),
    })),
    page: 1,
    hasMore: false,
  }
}

async function discover({ view, query, filters }: DiscoverQuery, page: number, viewer: Viewer): Promise<CatalogPage> {
  if (view === 'plus-tard') return watchLaterPage(viewer)
  if (view === 'pour-toi') return forYou(viewer, page)

  const tmdb = getTmdb()
  const type: MediaType | undefined = view === 'films' ? 'movie' : view === 'series' ? 'tv' : undefined
  if (query) return fromPaged(await tmdb.search(type ?? 'multi', query, page), page, type)
  if (activeFilterCount(filters) > 0) {
    return fromPaged(type ? await tmdb.discover(type, { ...filters, page }) : await tmdb.discoverMixed({ ...filters, page }), page, type)
  }
  return fromPaged(await tmdb.trending(type ?? 'all', page), page, type)
}

export async function loadCatalog(source: CatalogSource, page: number, viewer: Viewer): Promise<CatalogPage> {
  const safePage = Math.min(Math.max(1, Math.floor(page) || 1), MAX_PAGE)
  if (source.kind === 'discover') return discover(source.query, safePage, viewer)
  const tmdb = getTmdb()
  const paged =
    source.relation === 'similar'
      ? await tmdb.similar(source.mediaType, source.tmdbId, safePage)
      : await tmdb.recommendations(source.mediaType, source.tmdbId, safePage)
  return fromPaged(paged, safePage, source.mediaType)
}
