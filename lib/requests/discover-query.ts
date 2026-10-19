import type { DiscoverFilters } from '../services/tmdb/types'

/**
 * La découverte telle que l'URL la décrit (`/demandes?vue=films&genres=28`) :
 * partageable, et le bouton Retour retrouve la même vue. Sans dépendance
 * serveur : la page et le panneau de filtres lisent et écrivent le même format.
 * Options reprises de MediaHub (`media-filters-options.ts`).
 */
export const DISCOVER_VIEWS = [
  { id: 'tout', label: 'Tout' },
  { id: 'films', label: 'Films' },
  { id: 'series', label: 'Séries' },
  { id: 'plus-tard', label: 'À regarder plus tard' },
  { id: 'pour-toi', label: 'Pour toi' },
] as const

export type DiscoverView = (typeof DISCOVER_VIEWS)[number]['id']

export const SORT_OPTIONS = [
  { value: 'popularity.desc', label: 'Popularité (décroissante)' },
  { value: 'popularity.asc', label: 'Popularité (croissante)' },
  { value: 'vote_average.desc', label: 'Note (décroissante)' },
  { value: 'vote_average.asc', label: 'Note (croissante)' },
  { value: 'release_date.desc', label: 'Date (récent d\'abord)' },
  { value: 'release_date.asc', label: 'Date (ancien d\'abord)' },
] as const

export const LANGUAGES = [
  { code: 'fr', name: 'Français' },
  { code: 'en', name: 'Anglais' },
  { code: 'ja', name: 'Japonais' },
  { code: 'es', name: 'Espagnol' },
  { code: 'de', name: 'Allemand' },
  { code: 'it', name: 'Italien' },
  { code: 'ko', name: 'Coréen' },
  { code: 'zh', name: 'Chinois' },
] as const

export const REGIONS = [
  { value: 'FR', label: 'France' },
  { value: 'BE', label: 'Belgique' },
  { value: 'CH', label: 'Suisse' },
  { value: 'CA', label: 'Canada' },
  { value: 'US', label: 'États-Unis' },
  { value: 'GB', label: 'Royaume-Uni' },
  { value: 'DE', label: 'Allemagne' },
  { value: 'ES', label: 'Espagne' },
  { value: 'IT', label: 'Italie' },
  { value: 'AU', label: 'Australie' },
] as const

export const DEFAULT_SORT = 'popularity.desc'
export const DEFAULT_REGION = 'FR'

export interface DiscoverQuery {
  view: DiscoverView
  query: string
  filters: Omit<DiscoverFilters, 'page'>
}

type Params = { get(name: string): string | null }

const DATE = /^\d{4}-\d{2}-\d{2}$/

function ids(raw: string | null): number[] | undefined {
  const list = (raw ?? '')
    .split(',')
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0)
  return list.length > 0 ? list : undefined
}

export function parseDiscoverQuery(params: Params): DiscoverQuery {
  const rawView = params.get('vue')
  const view = DISCOVER_VIEWS.some((option) => option.id === rawView) ? (rawView as DiscoverView) : 'tout'
  const sort = params.get('tri')
  const language = params.get('langue')
  const region = params.get('region')
  const from = params.get('de')
  const to = params.get('a')
  return {
    view,
    query: (params.get('q') ?? '').trim().slice(0, 100),
    filters: {
      sortBy: SORT_OPTIONS.some((option) => option.value === sort) ? (sort ?? undefined) : undefined,
      genres: ids(params.get('genres')),
      from: from && DATE.test(from) ? from : undefined,
      to: to && DATE.test(to) ? to : undefined,
      originalLanguage: LANGUAGES.some((option) => option.code === language) ? (language ?? undefined) : undefined,
      watchRegion: REGIONS.some((option) => option.value === region) ? (region ?? undefined) : undefined,
      watchProviders: ids(params.get('plateformes')),
    },
  }
}

/** Les filtres actifs : sans eux, la vue montre les tendances de la semaine, comme MediaHub. */
export function activeFilterCount(filters: DiscoverQuery['filters']): number {
  return [
    filters.sortBy && filters.sortBy !== DEFAULT_SORT,
    filters.genres?.length,
    filters.from || filters.to,
    filters.originalLanguage,
    filters.watchProviders?.length,
  ].filter(Boolean).length
}

/** L'URL d'une vue, sans les paramètres vides. */
export function discoverHref(query: DiscoverQuery): string {
  const params = new URLSearchParams()
  if (query.view !== 'tout') params.set('vue', query.view)
  if (query.query) params.set('q', query.query)
  const { filters } = query
  if (filters.sortBy && filters.sortBy !== DEFAULT_SORT) params.set('tri', filters.sortBy)
  if (filters.genres?.length) params.set('genres', filters.genres.join(','))
  if (filters.from) params.set('de', filters.from)
  if (filters.to) params.set('a', filters.to)
  if (filters.originalLanguage) params.set('langue', filters.originalLanguage)
  if (filters.watchProviders?.length) {
    params.set('plateformes', filters.watchProviders.join(','))
    if (filters.watchRegion && filters.watchRegion !== DEFAULT_REGION) params.set('region', filters.watchRegion)
  }
  const search = params.toString()
  return search ? `/demandes?${search}` : '/demandes'
}
