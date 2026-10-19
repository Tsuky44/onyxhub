import 'server-only'
import { NotConfiguredError, normalizeBaseUrl } from '../http'
import { getSetting } from '../settings/store'
import { arrVersion, createArrClient, type ArrConfig } from './arr/client'

const SERVICE = 'Prowlarr'

export interface ProwlarrIndexer {
  id: number
  name: string
  enable: boolean
  protocol: string
  privacy?: 'public' | 'private' | 'semiPrivate'
}

export interface ProwlarrRelease {
  guid: string
  indexerId: number
  indexer: string
  title: string
  size: number
  seeders?: number
  leechers?: number
  grabs?: number
  publishDate: string
  protocol: string
  downloadUrl?: string
  magnetUrl?: string
  infoUrl?: string
  infoHash?: string
  categories?: { id: number; name: string }[]
}

export interface ProwlarrSearch {
  query: string
  indexerIds?: number[]
  /** Catégories Newznab : 2000 films, 5000 séries… */
  categories?: number[]
  limit?: number
  offset?: number
}

export interface Prowlarr {
  version(): Promise<string | null>
  indexers(): Promise<ProwlarrIndexer[]>
  search(search: ProwlarrSearch): Promise<ProwlarrRelease[]>
  /** Envoie une release au client de téléchargement configuré dans Prowlarr. */
  grab(release: Pick<ProwlarrRelease, 'guid' | 'indexerId'>): Promise<void>
}

/**
 * Le type de recherche selon les catégories choisies. Les valeurs sont celles
 * de l'interface de Prowlarr (`movie`, `tvsearch`, `music`, `book`) ; MediaHub
 * envoyait `moviesearch`, `audiosearch`, `booksearch`. À revérifier contre une
 * instance réelle en phase 6.
 */
export function searchType(categories: readonly number[] = []): string {
  const within = (low: number) => categories.some((category) => category >= low && category < low + 1000)
  if (within(2000)) return 'movie'
  if (within(5000)) return 'tvsearch'
  if (within(3000)) return 'music'
  if (within(7000)) return 'book'
  return 'search'
}

/** Les plus partagées d'abord, puis les plus récentes. */
export function sortReleases(releases: readonly ProwlarrRelease[]): ProwlarrRelease[] {
  return [...releases].sort(
    (a, b) => (b.seeders ?? 0) - (a.seeders ?? 0) || new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime(),
  )
}

export function createProwlarr(config: ArrConfig): Prowlarr {
  const api = createArrClient(SERVICE, 'v1', config)
  return {
    version: () => arrVersion(api),
    indexers: () => api.getStatic('/indexer'),
    async search({ query, indexerIds, categories, limit = 100, offset = 0 }) {
      const results = await api.get<ProwlarrRelease[]>('/search', {
        query: query.trim() || undefined,
        type: searchType(categories),
        // Clés répétées : Prowlarr ignore une liste séparée par des virgules (MediaHub le faisait pour les indexeurs).
        indexerIds,
        categories,
        limit,
        offset,
      })
      return sortReleases(Array.isArray(results) ? results : [])
    },
    async grab({ guid, indexerId }) {
      await api.post('/search', { guid, indexerId }, 30_000)
    },
  }
}

export function getProwlarr(): Prowlarr {
  const baseUrl = normalizeBaseUrl(getSetting('prowlarr_url'))
  const apiKey = getSetting('prowlarr_api_key')
  if (!baseUrl || !apiKey) throw new NotConfiguredError(SERVICE)
  return createProwlarr({ baseUrl, apiKey })
}
