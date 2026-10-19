import type { ServerState } from '../services/qbittorrent/types'
import type { StreamMessage, TorrentWire } from './torrents'

/**
 * L'état des torrents côté navigateur, tenu à jour par le flux SSE. Pure :
 * le hook ne fait qu'appliquer chaque message reçu.
 */
export interface LiveTorrents {
  /** Le premier état complet est arrivé. */
  ready: boolean
  torrents: ReadonlyMap<string, TorrentWire>
  server: ServerState
  categories: string[]
  tags: string[]
  /** L'erreur de qBit (identifiants, injoignable…), ou `null`. */
  error: string | null
}

export const EMPTY_LIVE: LiveTorrents = { ready: false, torrents: new Map(), server: {}, categories: [], tags: [], error: null }

export function applyStreamMessage(state: LiveTorrents, message: StreamMessage): LiveTorrents {
  if (message.type === 'snapshot') {
    return {
      ready: true,
      torrents: new Map(message.torrents.map((torrent) => [torrent.hash, torrent])),
      server: message.server,
      categories: message.categories,
      tags: message.tags,
      error: message.error,
    }
  }
  // Un différentiel arrivé avant l'état complet ne peut pas s'appliquer : l'état complet qui suit le contient déjà.
  if (!state.ready) return state
  const torrents = new Map(state.torrents)
  for (const torrent of message.upsert) torrents.set(torrent.hash, torrent)
  for (const hash of message.removed) torrents.delete(hash)
  return {
    ready: true,
    torrents,
    server: message.server,
    categories: message.categories ?? state.categories,
    tags: message.tags ?? state.tags,
    error: message.error,
  }
}
