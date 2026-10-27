import 'server-only'
import { readSession } from '../auth/session'
import { errorMessage } from '../http'
import { OnyxCapability, onyxSupports } from '../services/onyx/capabilities'
import { getOnyxShowEpisodes, type OnyxShowEpisodes } from '../services/onyx/library'
import { TtlCache } from '../ttl-cache'

/**
 * Les épisodes qu'Onyx peut lire, pour marquer « Disponible » ce qui se lit
 * vraiment (ADR-0014) : sorraa et Sonarr disent ce qu'ils ont importé, pas ce
 * qu'Onyx a indexé (un épisode copié à la main leur échappe).
 *
 * Une requête par série, toutes saisons ensemble, gardée 30 s : ouvrir trois
 * saisons de suite ne fait qu'un appel, et un épisode qu'Onyx vient d'indexer
 * apparaît à l'ouverture suivante.
 */
const cache = new TtlCache<OnyxShowEpisodes>(30_000, 50)

/** Les épisodes de la série par saison, ou `null` si Onyx ne les sert pas (trop ancien, injoignable). Jamais d'erreur : c'est un enrichissement. */
export async function onyxShowEpisodes(tmdbId: number): Promise<OnyxShowEpisodes | null> {
  if (!(await onyxSupports(OnyxCapability.libraryShowEpisodes))) return null
  try {
    const token = (await readSession())?.token
    if (!token) return null
    return await cache.load(String(tmdbId), () => getOnyxShowEpisodes(token, tmdbId))
  } catch (error) {
    console.warn(`[onyx] épisodes de la série ${tmdbId} : ${errorMessage(error)}`)
    return null
  }
}

/**
 * Le « a un fichier » d'un épisode une fois Onyx consulté : ce qu'Onyx lit est
 * disponible quoi qu'en disent sorraa ou Sonarr ; sinon leur avis reste, y
 * compris « ne suit pas la série » (`null`). Pure.
 */
export function withOnyxEpisode(
  tracked: boolean | null,
  onyx: OnyxShowEpisodes | null,
  seasonNumber: number,
  episodeNumber: number,
): boolean | null {
  return onyx?.get(seasonNumber)?.has(episodeNumber) ? true : tracked
}
