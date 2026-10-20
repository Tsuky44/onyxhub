import 'server-only'
import type { Viewer } from '../auth/permissions'
import { normalizeBaseUrl } from '../http'
import { getSetting } from '../settings/store'
import { localDay } from '../calendar/releases'
import { isSubscribed } from '../calendar/subscriptions'
import { isSubscribable } from '../calendar/tmdb-releases'
import { getTmdb } from '../services/tmdb/client'
import type { MediaType, TmdbDetails, TmdbVideo, TmdbWatchProviders } from '../services/tmdb/types'
import { seasonAvailability, type Availability } from './availability'
import { withStatus, type CatalogItem } from './catalog'
import { mediaDownloads, type DownloadProgress } from './downloads'
import { yearOf } from './format'
import { findSeries, getLibrary } from './library'
import { mediaAvailability } from './media-availability'
import { onyxLibrary, onyxMediaId, onyxWatchUrl, withOnyxPresence } from './onyx-presence'
import { requestsForMedia } from './repository'
import type { AvailabilityStatus, RequestStatus } from './status'
import { isInWatchLater } from './watch-later'

/** Tout ce que la fiche affiche, chargé en parallèle. */
export interface SeasonRow {
  seasonNumber: number
  name: string
  episodeCount: number
  year: string | null
  posterPath: string | null
  status: AvailabilityStatus
  requested: boolean
}

export interface MediaRequestView {
  id: number
  requester: string
  seasonNumber: number | null
  status: RequestStatus
  requestedAt: string
}

export interface CrewGroup {
  label: string
  people: { id: number; name: string }[]
}

export interface MediaPageData {
  details: TmdbDetails
  tvdbId: number | null
  availability: Availability
  requests: MediaRequestView[]
  seasons: SeasonRow[]
  inWatchLater: boolean
  /** Le compte est abonné aux sorties du média, et le bouton a du sens (encore des sorties devant). */
  subscription: { subscribed: boolean; available: boolean }
  trailer: TmdbVideo | null
  crew: CrewGroup[]
  providers: TmdbWatchProviders | null
  recommendations: CatalogItem[]
  similar: CatalogItem[]
  downloads: DownloadProgress[]
  /** La fiche dans Radarr/Sonarr, pour l'admin seulement. */
  externalUrl: string | null
  /** Le lien qui ouvre ce titre dans l'app web d'Onyx, quand Onyx l'a (ADR-0010). */
  onyxUrl: string | null
}

/** La bande-annonce : française d'abord, officielle ensuite, YouTube seulement (lue sans cookie). */
function pickTrailer(videos: readonly TmdbVideo[]): TmdbVideo | null {
  const youtube = videos.filter((video) => video.site === 'YouTube' && (video.type === 'Trailer' || video.type === 'Teaser'))
  const score = (video: TmdbVideo) => (video.type === 'Trailer' ? 4 : 0) + (video.iso_639_1 === 'fr' ? 2 : 0) + (video.official ? 1 : 0)
  return youtube.sort((a, b) => score(b) - score(a))[0] ?? null
}

function crewOf(details: TmdbDetails, mediaType: MediaType): CrewGroup[] {
  const crew = details.credits?.crew ?? []
  const people = (jobs: readonly string[]) => {
    const seen = new Set<number>()
    return crew.filter((member) => jobs.includes(member.job) && !seen.has(member.id) && seen.add(member.id)).map(({ id, name }) => ({ id, name }))
  }
  const creators = (details.created_by ?? []).map(({ id, name }) => ({ id, name }))
  const groups: CrewGroup[] = [
    mediaType === 'tv' ? { label: creators.length > 1 ? 'Création' : 'Créé par', people: creators } : { label: 'Réalisation', people: people(['Director']) },
    { label: 'Scénario', people: people(['Screenplay', 'Writer', 'Story', 'Novel']).slice(0, 4) },
    { label: 'Musique', people: people(['Original Music Composer', 'Music']).slice(0, 2) },
    { label: 'Image', people: people(['Director of Photography']).slice(0, 2) },
  ]
  return groups.filter((group) => group.people.length > 0)
}

async function externalUrl(mediaType: MediaType, tmdbId: number, tvdbId: number | null): Promise<string | null> {
  const index = await getLibrary()
  if (mediaType === 'movie') {
    const base = normalizeBaseUrl(getSetting('radarr_url'))
    const slug = index.movies.get(tmdbId)?.titleSlug
    return base && slug ? `${base}/movie/${slug}` : null
  }
  const base = normalizeBaseUrl(getSetting('sonarr_url'))
  const slug = findSeries(index, tmdbId, tvdbId)?.titleSlug
  return base && slug ? `${base}/series/${slug}` : null
}

function subscriptionState(userId: number, mediaType: MediaType, tmdbId: number, details: TmdbDetails): MediaPageData['subscription'] {
  const subscribed = isSubscribed(userId, mediaType, tmdbId)
  // Un abonnement déjà pris reste retirable, même une fois les sorties passées.
  return { subscribed, available: subscribed || isSubscribable(mediaType, details, localDay(new Date())) }
}

export async function loadMediaPage(mediaType: MediaType, tmdbId: number, viewer: Viewer): Promise<MediaPageData> {
  const details = await getTmdb().details(mediaType, tmdbId)
  const tvdbId = details.external_ids?.tvdb_id ?? null

  const [arrAvailability, recommendations, similar, downloads, external, onyx] = await Promise.all([
    mediaAvailability(mediaType, tmdbId, tvdbId),
    withStatus(details.recommendations?.results.slice(0, 20) ?? [], mediaType),
    withStatus(details.similar?.results.slice(0, 20) ?? [], mediaType),
    mediaDownloads(mediaType, tmdbId, tvdbId).catch(() => []),
    viewer.isAdmin ? externalUrl(mediaType, tmdbId, tvdbId) : Promise.resolve(null),
    onyxLibrary(),
  ])
  const onyxId = onyxMediaId(onyx, mediaType, tmdbId)
  const presentStatus = withOnyxPresence(arrAvailability.status, onyxId !== null)
  const availability =
    presentStatus === arrAvailability.status ? arrAvailability : { ...arrAvailability, status: presentStatus, available: true }

  const rows = requestsForMedia(mediaType, tmdbId)
  const requestedSeasons = new Set(rows.map((row) => row.seasonNumber))
  const seasons: SeasonRow[] = (details.seasons ?? [])
    .filter((season) => season.episode_count > 0 || season.season_number > 0)
    .sort((a, b) => (a.season_number === 0 ? 1 : b.season_number === 0 ? -1 : a.season_number - b.season_number))
    .map((season) => ({
      seasonNumber: season.season_number,
      name: season.name || (season.season_number === 0 ? 'Épisodes spéciaux' : `Saison ${season.season_number}`),
      episodeCount: season.episode_count,
      year: yearOf(season.air_date),
      posterPath: season.poster_path,
      status: seasonAvailability(availability, season.season_number),
      requested: requestedSeasons.has(season.season_number),
    }))

  return {
    details,
    tvdbId,
    availability,
    requests: rows.map((row) => ({
      id: row.id,
      requester: row.requester,
      seasonNumber: row.seasonNumber,
      status: row.status,
      requestedAt: row.requestedAt.toISOString(),
    })),
    seasons,
    // Onyx muet : la fiche s'affiche quand même, bouton « Plus tard » éteint.
    inWatchLater: await isInWatchLater(viewer, mediaType, tmdbId).catch(() => false),
    subscription: subscriptionState(viewer.id, mediaType, tmdbId, details),
    trailer: pickTrailer(details.videos?.results ?? []),
    crew: crewOf(details, mediaType),
    providers: details['watch/providers']?.results.FR ?? null,
    recommendations,
    similar,
    downloads,
    externalUrl: external,
    onyxUrl: onyxId === null ? null : onyxWatchUrl(mediaType, onyxId),
  }
}
