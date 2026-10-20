import 'server-only'
import { NotConfiguredError, request, requestJson, ServiceError } from '../../http'
import type { MediaType } from '../tmdb/types'
import { onyxBaseUrl } from './auth'

const SERVICE = 'Onyx'

/**
 * La liste « À regarder plus tard » du compte, tenue par Onyx (ADR-0070
 * d'Onyx), lue et écrite avec le jeton du compte connecté. La même liste
 * s'affiche dans l'app et dans OnyxHub.
 *
 * Onyx dit `show` là où TMDB et OnyxHub disent `tv` ; la traduction se fait
 * ici, une seule fois.
 */
export interface OnyxListItem {
  id: number
  mediaType: MediaType
  tmdbId: number
  title: string
  /** Chemin TMDB (`/abc.jpg`) quand l'affiche vient de TMDB ; `null` pour une affiche du serveur Onyx. */
  posterPath: string | null
}

export interface OnyxWatchLater {
  items(): Promise<OnyxListItem[]>
  add(item: { mediaType: MediaType; tmdbId: number; title: string; posterPath: string | null }): Promise<void>
  remove(itemId: number): Promise<void>
}

interface RawList {
  id: number
  kind: string
}

interface RawItem {
  id: number
  media_type: string
  tmdb_id: number
  title: string
  poster_url?: string
}

const TMDB_POSTER = /^https:\/\/image\.tmdb\.org\/t\/p\/[^/]+(\/[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|webp))$/

function toItem(raw: RawItem): OnyxListItem | null {
  const mediaType = raw.media_type === 'movie' ? 'movie' : raw.media_type === 'show' ? 'tv' : null
  // Un titre ajouté depuis le serveur sans identité TMDB n'a pas de fiche dans OnyxHub.
  if (!mediaType || !raw.tmdb_id) return null
  return { id: raw.id, mediaType, tmdbId: raw.tmdb_id, title: raw.title, posterPath: raw.poster_url?.match(TMDB_POSTER)?.[1] ?? null }
}

export function createOnyxWatchLater(baseUrl: string, token: string): OnyxWatchLater {
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  let listId: number | null = null

  // Onyx crée la liste à la première lecture des listes : elle existe toujours après cet appel.
  const watchLaterId = async (): Promise<number> => {
    if (listId !== null) return listId
    const lists = await requestJson<{ mine?: RawList[] }>(SERVICE, `${baseUrl}/api/lists`, { headers, timeoutMs: 5_000 })
    const found = lists.mine?.find((list) => list.kind === 'watch_later')
    if (!found) throw new ServiceError(SERVICE, 'Onyx n\'a pas rendu la liste « À regarder plus tard »')
    listId = found.id
    return listId
  }

  return {
    async items() {
      const id = await watchLaterId()
      const detail = await requestJson<{ items?: RawItem[] }>(SERVICE, `${baseUrl}/api/lists/${id}`, { headers, timeoutMs: 5_000 })
      return (detail.items ?? []).flatMap((raw) => toItem(raw) ?? [])
    },
    async add(item) {
      const id = await watchLaterId()
      await request(SERVICE, `${baseUrl}/api/lists/${id}/items`, {
        method: 'POST',
        headers,
        // Onyx refuse un chemin d'affiche qui n'a pas la forme TMDB : sans affiche, le titre s'ajoute quand même.
        body: JSON.stringify({ tmdb_id: item.tmdbId, media_type: item.mediaType, title: item.title, poster_path: item.posterPath ?? '' }),
        timeoutMs: 5_000,
        readErrorDetail: true,
      })
    },
    async remove(itemId) {
      const id = await watchLaterId()
      await request(SERVICE, `${baseUrl}/api/lists/${id}/items/${itemId}`, { method: 'DELETE', headers, timeoutMs: 5_000 })
    },
  }
}

export function getOnyxWatchLater(token: string): OnyxWatchLater {
  const baseUrl = onyxBaseUrl()
  if (!baseUrl) throw new NotConfiguredError(SERVICE)
  return createOnyxWatchLater(baseUrl, token)
}
