import 'server-only'
import { readSession } from '../auth/session'
import { errorMessage, normalizeBaseUrl } from '../http'
import { onyxBaseUrl } from '../services/onyx/auth'
import { OnyxCapability, onyxSupports } from '../services/onyx/capabilities'
import { getOnyxLibrary, type OnyxLibraryIndex } from '../services/onyx/library'
import { sorraaConfigured } from '../services/sorraa/client'
import type { MediaType } from '../services/tmdb/types'
import { getSetting } from '../settings/store'
import { TtlCache } from '../ttl-cache'
import type { AvailabilityStatus } from './status'

/**
 * Ce qu'Onyx a déjà, pour les cartes et la fiche (ADR-0010) : un titre
 * qu'Onyx a indexé est disponible, même quand Radarr ou Sonarr ne le
 * connaissent pas (ajouté à la main, autre outil), et la fiche peut alors
 * l'ouvrir dans Onyx.
 *
 * L'index est le même pour tous les comptes (Onyx n'a pas de bibliothèque par
 * compte) : un seul cache, gardé 60 s comme celui de Radarr/Sonarr.
 */
const cache = new TtlCache<OnyxLibraryIndex>(60_000, 1)

/** L'index d'Onyx, ou `null` si Onyx ne le sert pas (trop ancien, injoignable). Jamais d'erreur : c'est un enrichissement. */
export async function onyxLibrary(): Promise<OnyxLibraryIndex | null> {
  if (!(await onyxSupports(OnyxCapability.libraryIndex))) return null
  try {
    // Le poller de fond n'a pas de requête, donc pas de cookie : `readSession` y échoue, et Onyx reste inconnu.
    const token = (await readSession())?.token
    if (!token) return null
    return await cache.load('index', () => getOnyxLibrary(token))
  } catch (error) {
    console.warn(`[onyx] index de la bibliothèque : ${errorMessage(error)}`)
    return null
  }
}

export function onyxMediaId(index: OnyxLibraryIndex | null, mediaType: MediaType, tmdbId: number): number | null {
  if (!index) return null
  return (mediaType === 'movie' ? index.movies : index.shows).get(tmdbId) ?? null
}

/** Un statut « inconnu » de Radarr/Sonarr devient « disponible » quand Onyx a le titre. */
export function withOnyxPresence(status: AvailabilityStatus, inOnyx: boolean): AvailabilityStatus {
  return status === 'unknown' && inOnyx ? 'available' : status
}

/**
 * Le lien qui ouvre la fiche dans l'app web d'Onyx (`?movie=` / `?show=`,
 * ADR-0073 d'Onyx). L'adresse vue par le navigateur peut différer de celle
 * qu'OnyxHub utilise (un nom Docker) : `onyx_web_url` la fixe.
 */
export function onyxWatchUrl(mediaType: MediaType, mediaId: number): string | null {
  const base = normalizeBaseUrl(getSetting('onyx_web_url')) ?? onyxBaseUrl()
  if (!base) return null
  return `${base}/?${mediaType === 'movie' ? 'movie' : 'show'}=${mediaId}`
}

/**
 * Ce qui est « disponible » ou « partiel » ne l'est que si Onyx le voit
 * (ADR-0016) : un titre que sorraa a fini de télécharger mais qu'Onyx n'a pas
 * encore indexé est en cours d'import, pas lisible. Sans sorraa, Radarr et
 * Sonarr gardent leur mot (`withOnyxPresence`).
 */
export function seenByOnyx(status: AvailabilityStatus, inOnyx: boolean): AvailabilityStatus {
  if (inOnyx) return withOnyxPresence(status, true)
  return status === 'available' || status === 'partial' ? 'processing' : status
}

/** Le statut d'une carte : la règle d'Onyx avec sorraa, celle de Radarr et Sonarr sans. */
export function cardStatus(status: AvailabilityStatus, inOnyx: boolean): AvailabilityStatus {
  return sorraaConfigured() ? seenByOnyx(status, inOnyx) : withOnyxPresence(status, inOnyx)
}
