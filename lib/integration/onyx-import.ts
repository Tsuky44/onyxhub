import 'server-only'
import { errorMessage } from '../http'
import { isImport, type ArrEvent } from '../requests/webhook-payload'
import { onyxBaseUrl } from '../services/onyx/auth'
import { OnyxCapability, onyxSupports } from '../services/onyx/capabilities'
import { announceImport } from '../services/onyx/imports'
import { getSetting } from '../settings/store'

/** Au plus 100 chemins par annonce : la limite qu'Onyx accepte. */
const MAX_PATHS = 100

/**
 * Prévient Onyx qu'un import Radarr/Sonarr vient d'avoir lieu (ADR-0011) :
 * le titre devient lisible dans Onyx en secondes plutôt qu'au prochain
 * passage de son moniteur (5 minutes, et aveugle sur un partage réseau).
 *
 * Ne lève jamais : le webhook a déjà fait son travail côté demandes, et
 * l'indexation d'Onyx finira par passer sans ce signal.
 */
export async function notifyOnyxOfImport(event: ArrEvent): Promise<void> {
  if (!isImport(event)) return
  const baseUrl = onyxBaseUrl()
  const key = getSetting('integration_api_key')
  if (!baseUrl || !key || !(await onyxSupports(OnyxCapability.importSignal))) return
  try {
    await announceImport(baseUrl, key, { tmdbId: event.tmdbId, mediaType: event.mediaType, paths: (event.paths ?? []).slice(0, MAX_PATHS) })
  } catch (error) {
    console.warn(`[onyx] annonce de l'import ${event.mediaType}/${event.tmdbId ?? event.tvdbId} : ${errorMessage(error)}`)
  }
}
