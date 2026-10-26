import 'server-only'
import { eachLimited } from '../concurrency'
import type { MediaRequestRow } from '../db/schema'
import { errorMessage } from '../http'
import { getSorraa, type SorraaRequest } from '../services/sorraa/client'
import type { OnyxLibraryIndex } from '../services/onyx/library'
import { onyxMediaId } from './onyx-presence'
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

const ORDER: readonly AvailabilityStatus[] = ['unknown', 'pending', 'processing', 'partial', 'available']
const furthest = (states: readonly AvailabilityStatus[]): AvailabilityStatus | undefined =>
  states.reduce<AvailabilityStatus | undefined>((best, state) => (best === undefined || ORDER.indexOf(state) > ORDER.indexOf(best) ? state : best), undefined)

/** L'état que les demandes de sorraa donnent à une ligne (un film, ou une saison). */
export function reportedState(row: Pick<MediaRequestRow, 'seasonNumber'>, requests: readonly SorraaRequest[]): AvailabilityStatus | undefined {
  if (row.seasonNumber === null) return furthest(requests.map((request) => request.state))
  return furthest(requests.flatMap((request) => request.seasons?.filter((season) => season.number === row.seasonNumber).map((season) => season.state) ?? []))
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
