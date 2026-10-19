import 'server-only'
import { NotConfiguredError, requestJson, withQuery, type QueryValue } from '../../http'
import { getSetting } from '../../settings/store'
import { TtlCache } from '../../ttl-cache'
import { discoverParams, sortMixed } from './discover'
import { genresForMovies, genresForShows } from './genres'
import type {
  DiscoverFilters,
  MediaType,
  Paged,
  TmdbCollection,
  TmdbDetails,
  TmdbExternalIds,
  TmdbGenre,
  TmdbPerson,
  TmdbSeason,
  TmdbSummary,
  TmdbWatchProvider,
} from './types'

const SERVICE = 'TMDB'
const BASE = 'https://api.themoviedb.org/3'
const LANGUAGE = 'fr-FR'

const MINUTE = 60_000
const HOUR = 60 * MINUTE

/**
 * Durées de cache par nature de donnée : une fiche bouge peu, une liste
 * « tendances » change dans la journée, les genres presque jamais.
 * MediaHub gardait les affiches dans une Map perdue à chaque redémarrage et
 * rappelait TMDB pour chaque carte.
 */
const TTL = { list: 10 * MINUTE, trending: HOUR, details: 6 * HOUR, static: 24 * HOUR } as const

// Partagé entre toutes les instances : la clé TMDB ne fait pas partie de la
// clé de cache, une réponse est la même quel que soit le compte qui la lit.
const cache = new TtlCache<unknown>(TTL.details, 1_000)

/**
 * Une clé v3 (32 caractères) passe en paramètre `api_key` ; un jeton v4 (JWT,
 * bien plus long) passe en `Authorization`. MediaHub n'acceptait que la v3.
 */
export function tmdbAuth(key: string): { params: Record<string, string>; headers: Record<string, string> } {
  return key.length > 40 ? { params: {}, headers: { Authorization: `Bearer ${key}` } } : { params: { api_key: key }, headers: {} }
}

export interface Tmdb {
  /** Vérifie la clé (bouton « Tester »). */
  check(): Promise<void>
  details(type: MediaType, id: number): Promise<TmdbDetails>
  season(tvId: number, seasonNumber: number): Promise<TmdbSeason>
  collection(id: number): Promise<TmdbCollection>
  person(id: number): Promise<TmdbPerson>
  externalIds(type: MediaType, id: number): Promise<TmdbExternalIds>
  recommendations(type: MediaType, id: number, page?: number): Promise<Paged<TmdbSummary>>
  similar(type: MediaType, id: number, page?: number): Promise<Paged<TmdbSummary>>
  discover(type: MediaType, filters?: DiscoverFilters): Promise<Paged<TmdbSummary>>
  /** Films et séries mêlés (onglet « Tout »), triés ensemble. */
  discoverMixed(filters?: DiscoverFilters): Promise<Paged<TmdbSummary>>
  search(type: MediaType | 'multi', query: string, page?: number): Promise<Paged<TmdbSummary>>
  trending(type: MediaType | 'all', page?: number): Promise<Paged<TmdbSummary>>
  genres(type: MediaType): Promise<TmdbGenre[]>
  watchProviders(type: MediaType, region?: string): Promise<TmdbWatchProvider[]>
}

function withType<T extends TmdbSummary>(page: Paged<T>, type: MediaType): Paged<T> {
  return { ...page, results: page.results.map((item) => ({ ...item, media_type: item.media_type ?? type })) }
}

export function createTmdb(apiKey: string): Tmdb {
  const auth = tmdbAuth(apiKey)

  function get<T>(path: string, params: Record<string, QueryValue>, ttlMs: number | null): Promise<T> {
    const publicUrl = withQuery(`${BASE}${path}`, { language: LANGUAGE, ...params })
    const load = () =>
      requestJson<T>(SERVICE, withQuery(publicUrl, auth.params), { headers: auth.headers, timeoutMs: 8_000 })
    if (ttlMs === null) return load()
    return cache.load(publicUrl, load, ttlMs) as Promise<T>
  }

  const tmdb: Tmdb = {
    async check() {
      await get('/configuration', {}, null)
    },
    details: (type, id) =>
      get(
        `/${type}/${id}`,
        {
          // Une seule requête au lieu de six : la fiche, le casting, les
          // vidéos, les mots-clés, les identifiants et les plateformes.
          append_to_response: 'credits,videos,keywords,external_ids,watch/providers,recommendations,similar',
          // Les bandes-annonces françaises d'abord, puis les originales.
          include_video_language: 'fr,en,null',
        },
        TTL.details,
      ),
    season: (tvId, seasonNumber) => get(`/tv/${tvId}/season/${seasonNumber}`, {}, TTL.details),
    collection: (id) => get(`/collection/${id}`, {}, TTL.details),
    person: (id) => get(`/person/${id}`, { append_to_response: 'combined_credits' }, TTL.details),
    externalIds: (type, id) => get(`/${type}/${id}/external_ids`, {}, TTL.static),
    recommendations: async (type, id, page = 1) =>
      withType(await get<Paged<TmdbSummary>>(`/${type}/${id}/recommendations`, { page }, TTL.details), type),
    similar: async (type, id, page = 1) => withType(await get<Paged<TmdbSummary>>(`/${type}/${id}/similar`, { page }, TTL.details), type),
    discover: async (type, filters = {}) =>
      withType(await get<Paged<TmdbSummary>>(`/discover/${type}`, discoverParams(type, filters), TTL.list), type),
    async discoverMixed(filters = {}) {
      const genres = filters.genres ?? []
      const movieGenres = genresForMovies(genres)
      const showGenres = genresForShows(genres)
      // Un genre propre aux séries (Talk-show…) ne donne aucun genre film :
      // on ne demande alors pas de films plutôt que des films sans filtre.
      const wantMovies = genres.length === 0 || movieGenres.length > 0
      const empty: Paged<TmdbSummary> = { page: filters.page ?? 1, results: [], total_pages: 0, total_results: 0 }
      const [movies, shows] = await Promise.all([
        wantMovies ? tmdb.discover('movie', { ...filters, genres: movieGenres }) : Promise.resolve(empty),
        tmdb.discover('tv', { ...filters, genres: showGenres }),
      ])
      return {
        page: filters.page ?? 1,
        results: sortMixed([...movies.results, ...shows.results], filters.sortBy),
        total_pages: Math.max(movies.total_pages, shows.total_pages),
        total_results: movies.total_results + shows.total_results,
      }
    },
    async search(type, query, page = 1) {
      const result = await get<Paged<TmdbSummary>>(`/search/${type}`, { query, page, include_adult: false }, TTL.list)
      if (type !== 'multi') return withType(result, type)
      // La recherche mixte renvoie aussi des personnes : la page Demandes n'en veut pas.
      return { ...result, results: result.results.filter((item) => item.media_type === 'movie' || item.media_type === 'tv') }
    },
    async trending(type, page = 1) {
      const result = await get<Paged<TmdbSummary>>(`/trending/${type}/week`, { page }, TTL.trending)
      return type === 'all' ? result : withType(result, type)
    },
    genres: async (type) => (await get<{ genres: TmdbGenre[] }>(`/genre/${type}/list`, {}, TTL.static)).genres,
    watchProviders: async (type, region = 'FR') =>
      (await get<{ results: TmdbWatchProvider[] }>(`/watch/providers/${type}`, { watch_region: region }, TTL.static)).results
        .slice()
        .sort((a, b) => (a.display_priority ?? 999) - (b.display_priority ?? 999)),
  }
  return tmdb
}

/** TMDB avec la clé de Réglages. */
export function getTmdb(): Tmdb {
  const key = getSetting('tmdb_api_key')
  if (!key) throw new NotConfiguredError(SERVICE)
  return createTmdb(key)
}

/** Vide le cache TMDB (tests, changement de clé). */
export function clearTmdbCache(): void {
  cache.clear()
}
