import 'server-only'
import { NotConfiguredError, normalizeBaseUrl, request, requestJson, ServiceError, withQuery } from '../../http'
import { getSetting } from '../../settings/store'
import type { MediaType } from '../tmdb/types'

const SERVICE = 'sorraa'

/** Les états d'une demande chez sorraa (`pending`, `processing`, `partial`, `available`). */
export type SorraaState = 'pending' | 'processing' | 'partial' | 'available'

export interface SorraaRequest {
  id: number
  /** Le média de la bibliothèque de sorraa qui sert la demande. */
  mediaId: number
  kind: 'movie' | 'series'
  tmdbId: number
  state: SorraaState
  /** Absent pour un film. */
  seasons?: { number: number; state: SorraaState }[]
}

export interface SorraaRequestInput {
  mediaType: MediaType
  tmdbId: number
  /** Les saisons voulues ; vide ou absent, toute la série (hors spéciaux). */
  seasons?: readonly number[]
  requester: { name: string; ref: string }
}

export interface Sorraa {
  version(): Promise<string | null>
  /** Crée la demande ; `created` est faux quand le demandeur avait déjà demandé tout cela. */
  createRequest(input: SorraaRequestInput): Promise<{ request: SorraaRequest; created: boolean }>
  requestsFor(mediaType: MediaType, tmdbId: number): Promise<SorraaRequest[]>
  /**
   * Retire une demande, ou seulement ces saisons, et avec `stopSearching`
   * arrête la recherche de ce que plus personne ne demande.
   */
  withdraw(requestId: number, options: { seasons?: readonly number[]; stopSearching: boolean }): Promise<void>
  /** Le média de la bibliothèque de sorraa pour ce titre, `null` s'il n'y est pas. */
  mediaId(mediaType: MediaType, tmdbId: number): Promise<number | null>
  /** Sort le média de la bibliothèque ; ses fichiers vont à la corbeille avec `deleteFiles`. */
  removeMedia(mediaId: number, deleteFiles: boolean): Promise<void>
  /** Sort une saison de la recherche et des demandes ; ses fichiers vont à la corbeille avec `deleteFiles`. */
  removeSeason(mediaId: number, season: number, deleteFiles: boolean): Promise<void>
}

export interface SorraaConfig {
  baseUrl: string
  /** Vide tant que sorraa n'exige pas de clé. */
  apiKey?: string
}

const kindOf = (mediaType: MediaType): 'movie' | 'series' => (mediaType === 'movie' ? 'movie' : 'series')

/** Au plus 20 pages de 200 médias pour retrouver un titre sans demande. */
const MEDIA_PAGES = 20

export function createSorraa(config: SorraaConfig): Sorraa {
  const root = `${config.baseUrl}/api/v1`
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`
  const jsonHeaders = { ...headers, 'Content-Type': 'application/json' }
  const call = (url: string, init: { method?: string; body?: unknown } = {}) =>
    request(SERVICE, url, {
      method: init.method,
      headers: init.body === undefined ? headers : jsonHeaders,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      readErrorDetail: true,
      timeoutMs: 30_000,
    })

  return {
    async version() {
      const health = await requestJson<{ version?: string }>(SERVICE, `${root}/health`, { headers })
      return typeof health.version === 'string' ? health.version : null
    },

    async createRequest(input) {
      const response = await call(`${root}/requests`, {
        method: 'POST',
        body: {
          kind: kindOf(input.mediaType),
          tmdbId: input.tmdbId,
          ...(input.mediaType === 'tv' && input.seasons && input.seasons.length > 0 ? { seasons: [...input.seasons] } : {}),
          requester: input.requester,
        },
      })
      return { request: (await response.json()) as SorraaRequest, created: response.status === 201 }
    },

    async requestsFor(mediaType, tmdbId) {
      const page = await requestJson<{ items: SorraaRequest[] }>(
        SERVICE,
        withQuery(`${root}/requests`, { kind: kindOf(mediaType), tmdbId, limit: 200 }),
        { headers, readErrorDetail: true },
      )
      return page.items
    },

    async withdraw(requestId, options) {
      await call(
        withQuery(`${root}/requests/${requestId}`, {
          seasons: options.seasons && options.seasons.length > 0 ? options.seasons.join(',') : undefined,
          stopSearching: options.stopSearching ? 'true' : undefined,
        }),
        { method: 'DELETE' },
      )
    },

    async mediaId(mediaType, tmdbId) {
      const known = (await this.requestsFor(mediaType, tmdbId))[0]
      if (known) return known.mediaId
      let cursor: string | undefined
      for (let page = 0; page < MEDIA_PAGES; page++) {
        const result = await requestJson<{ items: { id: number; tmdbId: number }[]; nextCursor?: string }>(
          SERVICE,
          withQuery(`${root}/media`, { kind: kindOf(mediaType), limit: 200, cursor }),
          { headers, readErrorDetail: true },
        )
        const found = result.items.find((item) => item.tmdbId === tmdbId)
        if (found) return found.id
        if (!result.nextCursor) return null
        cursor = result.nextCursor
      }
      return null
    },

    async removeMedia(mediaId, deleteFiles) {
      await call(withQuery(`${root}/media/${mediaId}`, { deleteFiles: deleteFiles ? 'true' : undefined }), { method: 'DELETE' })
    },

    async removeSeason(mediaId, season, deleteFiles) {
      await call(withQuery(`${root}/media/${mediaId}/seasons/${season}`, { deleteFiles: deleteFiles ? 'true' : undefined }), { method: 'DELETE' })
    },
  }
}

/** Les demandes passent par sorraa dès que son adresse est renseignée. */
export function sorraaConfigured(): boolean {
  return normalizeBaseUrl(getSetting('sorraa_url')) !== null
}

/** sorraa avec les réglages, ou une `NotConfiguredError`. */
export function getSorraa(): Sorraa {
  const baseUrl = normalizeBaseUrl(getSetting('sorraa_url'))
  if (!baseUrl) throw new NotConfiguredError(SERVICE)
  return createSorraa({ baseUrl, apiKey: getSetting('sorraa_api_key') })
}

export { ServiceError }
