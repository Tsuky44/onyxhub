import 'server-only'
import { errorMessage } from '../http'
import { requestsForMedia, updateStatuses } from '../requests/repository'
import { notifyOnyxOfImport } from './onyx-import'
import { asArrEvent, statusChangesFromSorraa, type SorraaEvent } from './sorraa'

/**
 * Applique des événements de sorraa, dans l'ordre : l'état de ses demandes
 * fait avancer celles d'OnyxHub, et un import est annoncé à Onyx. Renvoie le
 * nombre de demandes changées.
 */
export async function applySorraaEvents(events: readonly SorraaEvent[]): Promise<number> {
  let changed = 0
  for (const event of events) {
    const changes = statusChangesFromSorraa(requestsForMedia(event.mediaType, event.tmdbId), event)
    updateStatuses(changes)
    changed += changes.size
    const imported = asArrEvent(event)
    // Onyx est prévenu sans retarder la réponse due à sorraa.
    if (imported) void notifyOnyxOfImport(imported).catch((error) => console.warn(`[sorraa] annonce de l'import : ${errorMessage(error)}`))
  }
  return changed
}
