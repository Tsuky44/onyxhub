import 'server-only'
import { errorMessage } from '../http'
import { requestsForMedia } from '../requests/repository'
import type { RequestStatus } from '../requests/status'
import { getQbittorrent } from '../services/qbittorrent/client'
import { qbitLive } from '../services/qbittorrent/live'
import type { TorrentFile, TorrentPeer, TorrentProperties, TorrentTracker } from '../services/qbittorrent/types'
import { TtlCache } from '../ttl-cache'
import { torrentMedia, type TorrentMedia } from './torrent-media'
import { toWire, type TorrentWire } from './torrents'

/** Tout ce que la page d'un torrent affiche, chaque partie pouvant manquer sans faire tomber les autres. */
export interface TorrentDetail {
  torrent: TorrentWire
  properties: TorrentProperties | null
  files: TorrentFile[] | null
  trackers: TorrentTracker[] | null
  peers: TorrentPeer[] | null
  /** Les parties que qBit n'a pas pu donner. */
  errors: string[]
}

export async function loadTorrentDetail(hash: string): Promise<TorrentDetail | null> {
  const key = hash.toLowerCase()
  const state = await qbitLive().snapshot()
  const torrent = state.torrents[key]
  if (!torrent) return null
  const qbit = getQbittorrent()
  const errors: string[] = []
  const part = <T,>(label: string, load: () => Promise<T>) =>
    load().catch((error: unknown) => {
      errors.push(`${label} : ${errorMessage(error)}`)
      return null
    })
  const [properties, files, trackers, peers] = await Promise.all([
    part('informations', () => qbit.properties(key)),
    part('fichiers', () => qbit.files(key)),
    part('trackers', () => qbit.trackers(key)),
    part('pairs', () => qbit.peers(key)),
  ])
  return { torrent: toWire(torrent), properties, files, trackers, peers, errors }
}

export interface LinkedMedia extends TorrentMedia {
  requests: { requester: string; seasonNumber: number | null; status: RequestStatus }[]
}

// La page se rafraîchit toutes les 5 s : le média d'un torrent ne change pas, inutile de reconsulter Radarr, Sonarr ou TMDB.
const mediaCache = new TtlCache<TorrentMedia | null>(10 * 60_000, 200)

export async function linkedMedia(torrent: { hash: string; name: string }): Promise<LinkedMedia | null> {
  const media = await mediaCache.load(torrent.hash.toLowerCase(), () => torrentMedia(torrent))
  if (!media) return null
  // Les demandes, elles, se relisent à chaque fois : leur statut avance pendant le téléchargement.
  const requests = requestsForMedia(media.mediaType, media.tmdbId).map((row) => ({ requester: row.requester, seasonNumber: row.seasonNumber, status: row.status }))
  return { ...media, requests }
}
