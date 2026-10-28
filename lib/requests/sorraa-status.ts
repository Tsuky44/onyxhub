import 'server-only'
import { eachLimited } from '../concurrency'
import type { MediaRequestRow } from '../db/schema'
import { errorMessage } from '../http'
import { getSorraa, type SorraaRequest } from '../services/sorraa/client'
import type { OnyxLibraryIndex } from '../services/onyx/library'
import type { MediaType } from '../services/tmdb/types'
import type { Availability, SeasonAvailability } from './availability'
import { onyxMediaId, seenByOnyx, withOnyxPresence } from './onyx-presence'
import { requestStatusFrom, type AvailabilityStatus, type RequestStatus } from './status'

/**
 * Le statut d'une demande quand sorraa est branché : tout ce qui précède la
 * disponibilité (cherche, télécharge, importe) vient de sorraa, mais
 * « disponible » ne vient que d'Onyx, qui dit ce qui se lit vraiment. Un titre
 * que sorraa dit « disponible » sans qu'Onyx l'ait indexé est encore « en
 * cours » (import, scan d'Onyx).
 *
 * `inOnyx` vaut `null` quand Onyx n'a pas pu être interrogé (pas de session,
 * Onyx éteint) : rien n'est alors promu « disponible ». Pure.
 */
export function statusFromSorraaAndOnyx(
  current: RequestStatus,
  isMovie: boolean,
  reported: AvailabilityStatus | undefined,
  inOnyx: boolean | null,
): RequestStatus {
  // Onyx ne connaît que le titre, pas ses saisons : une saison que sorraa dit
  // encore en cours (nouvelle saison d'une série déjà là) ne devient pas « disponible ».
  if (inOnyx && (isMovie || reported === undefined || reported === 'available')) return 'available'
  if (reported === undefined) return current
  return requestStatusFrom(current, reported === 'available' ? 'processing' : reported)
}

/**
 * Ce que la fiche et les cartes montrent d'un média ou d'une saison : même
 * règle que pour les demandes, mais sans demande à faire avancer. `fallback` est
 * ce que disent Radarr/Sonarr quand sorraa ne dit rien. Pure.
 */
export function presentedStatus(
  reported: AvailabilityStatus | undefined,
  inOnyx: boolean,
  isMovie: boolean,
  fallback: AvailabilityStatus,
  viaSorraa = false,
): AvailabilityStatus {
  // `fallback` vient de sorraa quand il est branché : « disponible » y veut dire
  // téléchargé, pas lisible. Seul Onyx le voit (ADR-0016).
  if (reported === undefined) return viaSorraa ? seenByOnyx(fallback, inOnyx) : withOnyxPresence(fallback, inOnyx)
  if (inOnyx && (isMovie || reported === 'available')) return 'available'
  return seenByOnyx(reported === 'available' ? 'processing' : reported, inOnyx)
}

const ORDER: readonly AvailabilityStatus[] = ['unknown', 'pending', 'processing', 'partial', 'available']
const furthest = (states: readonly AvailabilityStatus[]): AvailabilityStatus | undefined =>
  states.reduce<AvailabilityStatus | undefined>((best, state) => (best === undefined || ORDER.indexOf(state) > ORDER.indexOf(best) ? state : best), undefined)

/** L'état que les demandes de sorraa donnent à une ligne (un film, ou une saison). */
export function reportedState(row: Pick<MediaRequestRow, 'seasonNumber'>, requests: readonly SorraaRequest[]): AvailabilityStatus | undefined {
  if (row.seasonNumber === null) return furthest(requests.map((request) => request.state))
  return furthest(requests.flatMap((request) => request.seasons?.filter((season) => season.number === row.seasonNumber).map((season) => season.state) ?? []))
}

/**
 * La disponibilité de la fiche : celle de Radarr/Sonarr, corrigée par sorraa
 * (demandé, en cours, partiel) et par Onyx (disponible). Sans demande chez
 * sorraa, ou sorraa muet, elle ne change que par la présence dans Onyx.
 */
export function presentedAvailability(
  arr: Availability,
  mediaType: MediaType,
  requests: readonly SorraaRequest[] | null,
  inOnyx: boolean,
): Availability {
  const isMovie = mediaType === 'movie'
  const known = requests && requests.length > 0 ? requests : null
  // sorraa a répondu (même sans demande) : c'est lui, et non Radarr, qui a donné `arr`.
  const viaSorraa = requests !== null
  const status = presentedStatus(known ? furthest(known.map((request) => request.state)) : undefined, inOnyx, isMovie, arr.status, viaSorraa)

  const numbers = new Set([...arr.seasons.map((season) => season.seasonNumber), ...(known ?? []).flatMap((request) => request.seasons?.map((season) => season.number) ?? [])])
  const seasons = [...numbers]
    .sort((a, b) => a - b)
    .map((seasonNumber): SeasonAvailability => {
      const base = arr.seasons.find((season) => season.seasonNumber === seasonNumber) ?? { seasonNumber, status: 'unknown', available: false, totalEpisodes: 0, episodeFileCount: 0 }
      const reported = known ? reportedState({ seasonNumber }, known) : undefined
      // Onyx ne connaît que le titre : une saison sans fichier, ni demande, ni
      // suivi reste « inconnue » (on propose de la demander) au lieu de passer
      // « disponible » parce que la série, elle, est dans Onyx.
      const next = reported === undefined && base.status === 'unknown' ? 'unknown' : presentedStatus(reported, inOnyx, false, base.status, viaSorraa)
      return { ...base, status: next, available: next === 'available' || next === 'partial' || base.available }
    })

  if (status === arr.status && seasons.every((season, index) => season.status === arr.seasons[index]?.status)) return arr
  return { status, available: status === 'available' || status === 'partial', seasons }
}

/** Les nouveaux statuts de ces demandes d'après sorraa et Onyx. Un échec de sorraa pour un média laisse ses lignes à Onyx seul. */
export async function sorraaStatusChanges(rows: readonly MediaRequestRow[], onyx: OnyxLibraryIndex | null): Promise<Map<number, RequestStatus>> {
  const groups = new Map<string, MediaRequestRow[]>()
  for (const row of rows) {
    const key = `${row.mediaType}:${row.tmdbId}`
    groups.set(key, [...(groups.get(key) ?? []), row])
  }

  const changes = new Map<number, RequestStatus>()
  const sorraa = getSorraa()
  await eachLimited([...groups.values()], 4, async (group) => {
    const first = group[0]!
    let requests: SorraaRequest[] | null = null
    try {
      requests = await sorraa.requestsFor(first.mediaType, first.tmdbId)
    } catch (error) {
      console.warn(`[demandes] sorraa ${first.mediaType}/${first.tmdbId} : ${errorMessage(error)}`)
    }
    const inOnyx = onyx ? onyxMediaId(onyx, first.mediaType, first.tmdbId) !== null : null
    for (const row of group) {
      const next = statusFromSorraaAndOnyx(row.status, row.mediaType === 'movie', requests ? reportedState(row, requests) : undefined, inOnyx)
      if (next !== row.status) changes.set(row.id, next)
    }
  })
  return changes
}
