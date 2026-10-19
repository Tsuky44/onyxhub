/**
 * Les formes TMDB lues par OnyxHub. Seuls les champs utilisés sont typés ;
 * le reste de la réponse passe sans être décrit.
 */
export type MediaType = 'movie' | 'tv'

export interface Paged<T> {
  page: number
  results: T[]
  total_pages: number
  total_results: number
}

/** Une carte de catalogue : film ou série, selon `media_type` (ou le contexte de l'appel). */
export interface TmdbSummary {
  id: number
  media_type?: MediaType | 'person'
  title?: string
  name?: string
  original_title?: string
  original_name?: string
  overview?: string
  poster_path: string | null
  backdrop_path: string | null
  release_date?: string
  first_air_date?: string
  vote_average?: number
  vote_count?: number
  popularity?: number
  genre_ids?: number[]
  original_language?: string
}

export interface TmdbGenre {
  id: number
  name: string
}

export interface TmdbCastMember {
  id: number
  name: string
  character?: string
  profile_path: string | null
  order?: number
}

export interface TmdbCrewMember {
  id: number
  name: string
  job: string
  department: string
  profile_path: string | null
}

export interface TmdbVideo {
  key: string
  site: string
  type: string
  name: string
  official?: boolean
  iso_639_1?: string
}

export interface TmdbWatchProvider {
  provider_id: number
  provider_name: string
  logo_path: string | null
  display_priority?: number
}

export interface TmdbWatchProviders {
  link?: string
  flatrate?: TmdbWatchProvider[]
  rent?: TmdbWatchProvider[]
  buy?: TmdbWatchProvider[]
}

export interface TmdbExternalIds {
  imdb_id?: string | null
  tvdb_id?: number | null
}

export interface TmdbSeasonSummary {
  id: number
  season_number: number
  name: string
  episode_count: number
  air_date: string | null
  poster_path: string | null
  overview?: string
}

/** Une fiche, film ou série, avec ce qu'`append_to_response` y ajoute en un seul appel. */
export interface TmdbDetails extends TmdbSummary {
  genres?: TmdbGenre[]
  runtime?: number | null
  episode_run_time?: number[]
  tagline?: string
  status?: string
  budget?: number
  revenue?: number
  number_of_seasons?: number
  number_of_episodes?: number
  seasons?: TmdbSeasonSummary[]
  networks?: { id: number; name: string; logo_path: string | null }[]
  created_by?: { id: number; name: string; profile_path: string | null }[]
  last_air_date?: string | null
  in_production?: boolean
  production_companies?: { id: number; name: string; logo_path: string | null }[]
  belongs_to_collection?: { id: number; name: string; poster_path: string | null; backdrop_path: string | null } | null
  credits?: { cast: TmdbCastMember[]; crew: TmdbCrewMember[] }
  videos?: { results: TmdbVideo[] }
  keywords?: { keywords?: TmdbGenre[]; results?: TmdbGenre[] }
  external_ids?: TmdbExternalIds
  'watch/providers'?: { results: Record<string, TmdbWatchProviders> }
  recommendations?: Paged<TmdbSummary>
  similar?: Paged<TmdbSummary>
}

export interface TmdbEpisode {
  id: number
  episode_number: number
  season_number: number
  name: string
  overview?: string
  air_date: string | null
  still_path: string | null
  runtime?: number | null
  vote_average?: number
}

export interface TmdbSeason extends TmdbSeasonSummary {
  episodes: TmdbEpisode[]
}

export interface TmdbCollection {
  id: number
  name: string
  overview?: string
  poster_path: string | null
  backdrop_path: string | null
  parts: TmdbSummary[]
}

export interface TmdbPerson {
  id: number
  name: string
  biography?: string
  birthday?: string | null
  deathday?: string | null
  place_of_birth?: string | null
  profile_path: string | null
  known_for_department?: string
  combined_credits?: { cast: (TmdbSummary & { character?: string })[]; crew: (TmdbSummary & { job?: string })[] }
}

/** Filtres de la découverte (page Demandes), repris de MediaHub. */
export interface DiscoverFilters {
  page?: number
  sortBy?: string
  genres?: number[]
  /** Dates ISO (AAAA-MM-JJ) de sortie ou de première diffusion. */
  from?: string
  to?: string
  originalLanguage?: string
  minRuntime?: number
  maxRuntime?: number
  watchRegion?: string
  watchProviders?: number[]
  keywords?: string
}
