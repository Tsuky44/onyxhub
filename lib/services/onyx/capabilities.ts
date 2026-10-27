import 'server-only'
import { TtlCache } from '../../ttl-cache'
import { onyxBaseUrl, pingOnyx } from './auth'

/**
 * Les capacités que le serveur Onyx annonce sur `/api/ping`. OnyxHub ne suppose
 * jamais qu'Onyx est à jour : une fonction qui s'appuie sur une route récente
 * d'Onyx regarde d'abord ici, et garde son comportement d'avant sinon.
 */
export const OnyxCapability = {
  /** `/api/lists` : « À regarder plus tard » et les listes du compte (ADR-0070 d'Onyx). */
  watchLists: 'watch_lists',
  /** `GET /api/library/tmdb-index` : ce que la bibliothèque a, par identifiant TMDB (ADR-0073 d'Onyx). */
  libraryIndex: 'library_tmdb_index',
  /** `GET /api/library/shows/:tmdb/episodes` : les épisodes d'une série qu'Onyx peut lire (ADR-0082 d'Onyx). */
  libraryShowEpisodes: 'library_show_episodes',
  /** `POST /api/integrations/onyxhub/imported` : un import annoncé est indexé aussitôt (ADR-0074 d'Onyx). */
  importSignal: 'onyxhub_import_signal',
} as const

// 5 minutes : assez pour ne pas pinguer à chaque page, assez court pour voir une mise à jour d'Onyx.
const cache = new TtlCache<ReadonlySet<string>>(5 * 60_000, 4)

/** Vrai si Onyx annonce la capacité. Un Onyx injoignable n'annonce rien. */
export async function onyxSupports(capability: string): Promise<boolean> {
  const baseUrl = onyxBaseUrl()
  if (!baseUrl) return false
  try {
    const capabilities = await cache.load(baseUrl, async () => new Set((await pingOnyx(baseUrl)).capabilities))
    return capabilities.has(capability)
  } catch {
    // Onyx ne répond pas : les fonctions qui dépendent de lui retombent sur leur comportement d'avant.
    return false
  }
}
