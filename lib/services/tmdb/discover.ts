import type { QueryValue } from '../../http'
import type { DiscoverFilters, MediaType, TmdbSummary } from './types'

/**
 * Les règles de la découverte, sans appel réseau : traduction des filtres en
 * paramètres TMDB, et tri du mélange films + séries. Testables seules.
 */

/** Les champs de tri ne portent pas le même nom côté films et séries. */
export function sortFor(type: MediaType, sortBy = 'popularity.desc'): string {
  const [field = 'popularity', direction = 'desc'] = sortBy.split('.')
  if (type === 'tv') {
    if (field === 'primary_release_date' || field === 'release_date') return `first_air_date.${direction}`
    if (field === 'title' || field === 'original_title') return `name.${direction}`
  } else {
    if (field === 'first_air_date' || field === 'release_date') return `primary_release_date.${direction}`
    if (field === 'name') return `title.${direction}`
  }
  return `${field}.${direction}`
}

export function discoverParams(type: MediaType, filters: DiscoverFilters): Record<string, QueryValue> {
  const dateField = type === 'movie' ? 'primary_release_date' : 'first_air_date'
  return {
    page: filters.page ?? 1,
    sort_by: sortFor(type, filters.sortBy),
    // Sans plancher de votes, un tri par note remonte des titres à une seule voix.
    'vote_count.gte': filters.sortBy?.startsWith('vote_average') ? 50 : undefined,
    [`${dateField}.gte`]: filters.from,
    [`${dateField}.lte`]: filters.to,
    with_genres: filters.genres?.length ? filters.genres.join(',') : undefined,
    with_keywords: filters.keywords,
    with_original_language: filters.originalLanguage && filters.originalLanguage !== 'all' ? filters.originalLanguage : undefined,
    'with_runtime.gte': filters.minRuntime,
    'with_runtime.lte': filters.maxRuntime,
    watch_region: filters.watchProviders?.length ? (filters.watchRegion ?? 'FR') : undefined,
    // `|` = « l'une de ces plateformes », comme dans MediaHub.
    with_watch_providers: filters.watchProviders?.length ? filters.watchProviders.join('|') : undefined,
  }
}

function sortValue(item: TmdbSummary, field: string): string | number {
  switch (field) {
    case 'primary_release_date':
    case 'first_air_date':
    case 'release_date':
      return item.release_date || item.first_air_date || ''
    case 'title':
    case 'name':
      return (item.title || item.name || '').toLocaleLowerCase('fr')
    case 'vote_average':
      return item.vote_average ?? 0
    case 'vote_count':
      return item.vote_count ?? 0
    default:
      return item.popularity ?? 0
  }
}

/** Trie un mélange films + séries selon le tri demandé, avec le même vocabulaire que TMDB. */
export function sortMixed(items: TmdbSummary[], sortBy = 'popularity.desc'): TmdbSummary[] {
  const [field = 'popularity', direction = 'desc'] = sortBy.split('.')
  const sign = direction === 'asc' ? 1 : -1
  return [...items].sort((a, b) => {
    const left = sortValue(a, field)
    const right = sortValue(b, field)
    if (left === right) return 0
    return (left > right ? 1 : -1) * sign
  })
}
