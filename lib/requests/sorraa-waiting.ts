import 'server-only'
import { eachLimited } from '../concurrency'
import { errorMessage } from '../http'
import { getSorraa, sorraaConfigured } from '../services/sorraa/client'
import type { MediaType } from '../services/tmdb/types'
import type { RequestListPage } from './list'
import { earliestWaiting, type RequestWaiting } from './waiting'

/**
 * Pourquoi la demande de ce titre attend, d'après sorraa. `null` quand rien
 * n'attend, quand sorraa n'est pas branché ou quand il ne répond pas : la
 * fiche et la liste s'affichent sans cette ligne plutôt que de tomber.
 */
export async function waitingFor(mediaType: MediaType, tmdbId: number): Promise<RequestWaiting | null> {
  if (!sorraaConfigured()) return null
  try {
    return earliestWaiting(await getSorraa().requestsFor(mediaType, tmdbId))
  } catch (error) {
    console.warn(`[demandes] attente ${mediaType}/${tmdbId} : ${errorMessage(error)}`)
    return null
  }
}

/** La page de la liste, avec l'attente de chaque demande qui n'est pas encore disponible. */
export async function withWaiting(page: RequestListPage): Promise<RequestListPage> {
  if (!sorraaConfigured()) return page
  const waits = new Map<string, RequestWaiting | null>()
  const open = page.groups.filter((group) => group.status !== 'available')
  await eachLimited(open, 4, async (group) => {
    waits.set(`${group.mediaType}:${group.tmdbId}`, await waitingFor(group.mediaType, group.tmdbId))
  })
  return { ...page, groups: page.groups.map((group) => ({ ...group, waiting: waits.get(`${group.mediaType}:${group.tmdbId}`) ?? null })) }
}
