import type { Torrent } from './types'

/**
 * Les filtres de statut de la page Téléchargements (repris de MediaHub).
 *
 * qBittorrent 5 a renommé `pausedDL`/`pausedUP` en `stoppedDL`/`stoppedUP` :
 * MediaHub ne connaissait que les anciens noms, et un qBit à jour n'avait
 * plus aucun torrent « en pause ». Les deux sont reconnus ici.
 */
export const STATUS_FILTERS = [
  'all',
  'downloading',
  'seeding',
  'completed',
  'paused',
  'active',
  'inactive',
  'resumed',
  'stalled',
  'errored',
] as const

export type StatusFilter = (typeof STATUS_FILTERS)[number]

const DOWNLOADING = new Set(['downloading', 'metadl', 'forcedmetadl', 'allocating', 'checkingdl', 'forceddl', 'queueddl', 'stalleddl'])
const SEEDING = new Set(['uploading', 'stalledup', 'forcedup', 'queuedup', 'checkingup'])
const PAUSED = new Set(['pauseddl', 'pausedup', 'stoppeddl', 'stoppedup'])
const COMPLETED = new Set(['uploading', 'stalledup', 'forcedup', 'queuedup', 'checkingup', 'pausedup', 'stoppedup'])
const STALLED = new Set(['stalleddl', 'stalledup'])
const ERRORED = new Set(['error', 'missingfiles'])

export function isPaused(torrent: Pick<Torrent, 'state'>): boolean {
  return PAUSED.has(torrent.state.toLowerCase())
}

type StatusFields = Pick<Torrent, 'state' | 'dlspeed' | 'upspeed' | 'progress'>

export function matchesStatus(torrent: StatusFields, filter: StatusFilter): boolean {
  const state = torrent.state.toLowerCase()
  const moving = torrent.dlspeed > 0 || torrent.upspeed > 0
  switch (filter) {
    case 'all':
      return true
    case 'downloading':
      return DOWNLOADING.has(state)
    case 'seeding':
      return SEEDING.has(state)
    case 'completed':
      return COMPLETED.has(state) || torrent.progress >= 1
    case 'paused':
      return PAUSED.has(state)
    case 'active':
      return moving
    case 'inactive':
      return !moving
    case 'resumed':
      return !PAUSED.has(state)
    case 'stalled':
      return STALLED.has(state)
    case 'errored':
      return ERRORED.has(state)
  }
}

export function filterByStatus<T extends StatusFields>(torrents: readonly T[], filter: StatusFilter): T[] {
  return torrents.filter((torrent) => matchesStatus(torrent, filter))
}

/** Combien de torrents dans chaque filtre, pour les compteurs de la barre de statuts. */
export function countByStatus(torrents: readonly StatusFields[]): Record<StatusFilter, number> {
  const counts = Object.fromEntries(STATUS_FILTERS.map((filter) => [filter, 0])) as Record<StatusFilter, number>
  for (const torrent of torrents) for (const filter of STATUS_FILTERS) if (matchesStatus(torrent, filter)) counts[filter] += 1
  return counts
}
