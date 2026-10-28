import 'server-only'
import type { DownloadsSnapshot } from '../requests/downloads'
import type { MediaType } from '../services/tmdb/types'
import { toDownloadProgress, type SorraaDownload } from './sorraa'

/**
 * Le dernier rapport de sorraa sur les téléchargements en cours. sorraa le
 * renvoie au moins chaque minute : un rapport plus vieux que trois minutes
 * est périmé (sorraa éteint), et la fiche retombe sur la file Radarr/Sonarr.
 */
const TTL_MS = 3 * 60_000

const globalForReport = globalThis as unknown as { onyxhubSorraaDownloads?: { at: number; items: SorraaDownload[] } }

export function recordSorraaDownloads(items: SorraaDownload[], now = Date.now()): void {
  globalForReport.onyxhubSorraaDownloads = { at: now, items }
}

/**
 * `null` quand sorraa n'a pas de rapport récent : rien n'est dit, ce n'est pas
 * « aucun téléchargement ». L'âge part de la réception, pas de l'horodatage de
 * sorraa : les deux machines n'ont pas forcément la même heure.
 */
export function sorraaDownloadsFor(mediaType: MediaType, tmdbId: number, now = Date.now()): DownloadsSnapshot | null {
  const report = globalForReport.onyxhubSorraaDownloads
  if (!report || now - report.at > TTL_MS) return null
  const items = report.items
    .filter((item) => item.mediaType === mediaType && item.tmdbId === tmdbId)
    .map(toDownloadProgress)
    .sort((a, b) => (a.seasonNumber ?? 0) - (b.seasonNumber ?? 0))
  return { items, age: now - report.at }
}
