import 'server-only'
import { errorMessage, NotConfiguredError } from '../http'
import { getLibrary } from '../requests/library'
import { getRadarr } from '../services/arr/radarr'
import { getSonarr } from '../services/arr/sonarr'
import type { DiskSpace, HealthCheck } from '../services/arr/types'
import { getOnyxAdmin } from '../services/onyx/admin'
import type { OnyxNowPlaying, OnyxPlaybackStats, OnyxScanStatus, OnyxServerInfo } from '../services/onyx/types'
import { qbittorrentConfig } from '../services/qbittorrent/client'
import { matchesStatus } from '../services/qbittorrent/filters'
import { qbitLive } from '../services/qbittorrent/live'
import { TtlCache } from '../ttl-cache'

/**
 * Le résumé du serveur de l'accueil admin. Chaque bloc se charge et échoue
 * seul : Radarr éteint n'empêche pas de voir les lectures en cours d'Onyx.
 */
export type Block<T> = { ok: true; value: T } | { ok: false; message: string; notConfigured?: boolean }

export async function settle<T>(load: () => Promise<T>): Promise<Block<T>> {
  try {
    return { ok: true, value: await load() }
  } catch (error) {
    return { ok: false, message: errorMessage(error), notConfigured: error instanceof NotConfiguredError }
  }
}

// --- Onyx ---

export interface OnyxSummary {
  server: OnyxServerInfo
  nowPlaying: OnyxNowPlaying[]
  scan: OnyxScanStatus | null
}

export async function onyxSummary(token: string): Promise<Block<OnyxSummary>> {
  return settle(async () => {
    const onyx = getOnyxAdmin(token)
    const [server, nowPlaying, scan] = await Promise.all([onyx.server(), onyx.nowPlaying(), onyx.scanStatus().catch(() => null)])
    return { server, nowPlaying, scan }
  })
}

export function onyxStats(token: string, days = 30): Promise<Block<OnyxPlaybackStats>> {
  return settle(() => getOnyxAdmin(token).stats(days))
}

// --- qBittorrent ---

export interface DownloadsSummary {
  downloadSpeed: number
  uploadSpeed: number
  downloading: number
  seeding: number
  total: number
  ratio: string | null
  freeSpace: number | null
}

export async function downloadsSummary(): Promise<Block<DownloadsSummary> | null> {
  // Sans qBittorrent configuré, le bloc n'existe pas, plutôt qu'une erreur.
  if (!qbittorrentConfig()) return null
  const live = qbitLive()
  const state = await live.snapshot()
  const error = live.error()
  if (error && state.updatedAt === 0) return { ok: false, message: error }
  const torrents = Object.values(state.torrents)
  return {
    ok: true,
    value: {
      downloadSpeed: state.server.dl_info_speed ?? 0,
      uploadSpeed: state.server.up_info_speed ?? 0,
      downloading: torrents.filter((torrent) => matchesStatus(torrent, 'downloading')).length,
      seeding: torrents.filter((torrent) => matchesStatus(torrent, 'seeding')).length,
      total: torrents.length,
      ratio: state.server.global_ratio ?? null,
      freeSpace: state.server.free_space_on_disk ?? null,
    },
  }
}

// --- Radarr / Sonarr ---

export interface ArrHealth {
  service: 'Radarr' | 'Sonarr'
  type: HealthCheck['type']
  message: string
  wikiUrl?: string
}

export interface ArrSummary {
  /** `null` : service non configuré. */
  radarr: { queue: number } | null
  sonarr: { queue: number } | null
  health: ArrHealth[]
  disks: DiskSpace[]
  errors: string[]
}

// Santé et disques changent lentement : une minute de cache épargne les *arr à chaque rafraîchissement de l'accueil.
const arrCache = new TtlCache<unknown>(60_000, 10)

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  return arrCache.load(key, load) as Promise<T>
}

/** Les disques de Radarr et Sonarr fusionnés : un même volume n'apparaît qu'une fois. */
export function mergeDisks(lists: readonly DiskSpace[][]): DiskSpace[] {
  const byVolume = new Map<string, DiskSpace>()
  for (const disk of lists.flat()) {
    if (disk.totalSpace <= 0) continue
    // Docker monte souvent le même disque sous plusieurs chemins : on dédoublonne aussi par taille exacte.
    const key = `${disk.totalSpace}:${disk.freeSpace}`
    if (!byVolume.has(key)) byVolume.set(key, disk)
  }
  return [...byVolume.values()].sort((a, b) => a.freeSpace / a.totalSpace - b.freeSpace / b.totalSpace)
}

export async function arrSummary(): Promise<ArrSummary> {
  const errors: string[] = []
  const library = await getLibrary()

  const read = async <T>(service: 'Radarr' | 'Sonarr', key: string, load: () => Promise<T>, empty: T): Promise<T> => {
    try {
      return await cached(key, load)
    } catch (error) {
      if (!(error instanceof NotConfiguredError)) errors.push(`${service} : ${errorMessage(error)}`)
      return empty
    }
  }

  const [radarrHealth, sonarrHealth, radarrDisks, sonarrDisks] = await Promise.all([
    library.radarr ? read('Radarr', 'radarr-health', () => getRadarr().health(), [] as HealthCheck[]) : [],
    library.sonarr ? read('Sonarr', 'sonarr-health', () => getSonarr().health(), [] as HealthCheck[]) : [],
    library.radarr ? read('Radarr', 'radarr-disk', () => getRadarr().diskSpace(), [] as DiskSpace[]) : [],
    library.sonarr ? read('Sonarr', 'sonarr-disk', () => getSonarr().diskSpace(), [] as DiskSpace[]) : [],
  ])

  const health: ArrHealth[] = [
    ...radarrHealth.map((check) => ({ service: 'Radarr' as const, type: check.type, message: check.message, wikiUrl: check.wikiUrl })),
    ...sonarrHealth.map((check) => ({ service: 'Sonarr' as const, type: check.type, message: check.message, wikiUrl: check.wikiUrl })),
  ].filter((check) => check.type === 'warning' || check.type === 'error')

  return {
    radarr: library.radarr ? { queue: library.movieQueue.length } : null,
    sonarr: library.sonarr ? { queue: new Set(library.seriesQueue.map((item) => item.downloadId ?? item.id)).size } : null,
    health,
    disks: mergeDisks([radarrDisks, sonarrDisks]),
    errors,
  }
}
