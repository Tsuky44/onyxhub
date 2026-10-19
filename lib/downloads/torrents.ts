import type { StatusTone } from '../requests/status'
import { matchesStatus, type StatusFilter } from '../services/qbittorrent/filters'
import type { ServerState, Torrent } from '../services/qbittorrent/types'

/**
 * La liste des torrents de la page Téléchargements : ce qui part vers le
 * navigateur, et les filtres, tris et libellés qui s'y appliquent. Sans
 * dépendance serveur : le filtrage se fait côté client, sur l'état reçu en
 * direct, sans aller-retour.
 */

/** Un torrent tel qu'envoyé au navigateur (le lien magnet, long et inutile à l'écran, reste sur le serveur). */
export type TorrentWire = Omit<Torrent, 'magnet_uri'>

export function toWire(torrent: Torrent): TorrentWire {
  const { magnet_uri: _magnet, ...wire } = torrent
  return wire
}

/** Ce que le flux envoie : l'état complet à la connexion, puis seulement ce qui change. */
export type StreamMessage =
  | { type: 'snapshot'; torrents: TorrentWire[]; server: ServerState; categories: string[]; tags: string[]; error: string | null }
  | { type: 'patch'; upsert: TorrentWire[]; removed: string[]; server: ServerState; categories?: string[]; tags?: string[]; error: string | null }

/**
 * Les torrents ajoutés, modifiés ou retirés depuis le dernier envoi.
 * `applyMainData` ne recrée que les torrents qui ont changé : une simple
 * comparaison de références suffit, sans sérialiser 500 torrents toutes les
 * 5 secondes.
 */
export function diffTorrents(sent: ReadonlyMap<string, Torrent>, current: Readonly<Record<string, Torrent>>): { upsert: Torrent[]; removed: string[] } {
  const upsert = Object.values(current).filter((torrent) => sent.get(torrent.hash) !== torrent)
  const removed = [...sent.keys()].filter((hash) => !(hash in current))
  return { upsert, removed }
}

// --- Libellés ---

export const STATUS_LABELS: Record<StatusFilter, string> = {
  all: 'Tous',
  downloading: 'En cours',
  seeding: 'En partage',
  completed: 'Terminés',
  paused: 'En pause',
  active: 'Actifs',
  inactive: 'Inactifs',
  resumed: 'Démarrés',
  stalled: 'Bloqués',
  errored: 'Erreurs',
}

/** Les filtres de statut montrés en tête de liste (les autres restent disponibles par l'URL). */
export const VISIBLE_STATUSES: StatusFilter[] = ['all', 'downloading', 'seeding', 'completed', 'paused', 'active', 'stalled', 'errored']

const STATE_LABELS: Record<string, [string, StatusTone]> = {
  downloading: ['Téléchargement', 'accent'],
  forceddl: ['Téléchargement forcé', 'accent'],
  metadl: ['Métadonnées', 'accent'],
  forcedmetadl: ['Métadonnées', 'accent'],
  allocating: ['Allocation', 'warning'],
  stalleddl: ['Bloqué', 'warning'],
  queueddl: ['En file', 'warning'],
  checkingdl: ['Vérification', 'warning'],
  checkingup: ['Vérification', 'warning'],
  checkingresumedata: ['Vérification', 'warning'],
  moving: ['Déplacement', 'warning'],
  uploading: ['Partage', 'success'],
  forcedup: ['Partage forcé', 'success'],
  stalledup: ['Partage', 'success'],
  queuedup: ['En file', 'neutral'],
  pauseddl: ['En pause', 'neutral'],
  stoppeddl: ['En pause', 'neutral'],
  pausedup: ['Terminé', 'neutral'],
  stoppedup: ['Terminé', 'neutral'],
  error: ['Erreur', 'error'],
  missingfiles: ['Fichiers manquants', 'error'],
}

/** L'état d'un torrent en un mot et un ton (les noms de qBit 4 et 5). */
export function torrentState(torrent: Pick<Torrent, 'state'>): { label: string; tone: StatusTone } {
  const [label, tone] = STATE_LABELS[torrent.state.toLowerCase()] ?? ['Inconnu', 'neutral']
  return { label, tone }
}

/** « tracker.example.org:8080/announce » → « example.org ». Sans tracker (DHT, magnet sans annonce) : « Aucun ». */
export function trackerName(url: string): string {
  const first = url.split(/[\n,]/)[0]?.trim() ?? ''
  if (!first) return 'Aucun'
  try {
    const host = new URL(first.replace(/^udp:/, 'http:')).hostname
    const parts = host.split('.')
    return parts.length > 2 && /^(tracker|announce|t|tr|open)\d*$/.test(parts[0] ?? '') ? parts.slice(1).join('.') : host
  } catch {
    return first
  }
}

export function splitTags(tags: string): string[] {
  return tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

// --- Filtres ---

export interface TorrentFilters {
  status: StatusFilter
  search: string
  /** `''` : sans catégorie. */
  categories: string[]
  /** Tous les tags choisis doivent être présents. */
  tags: string[]
  trackers: string[]
  /** Ajoutés depuis ce jour (AAAA-MM-JJ), ou vide. */
  addedSince: string
}

export const DEFAULT_FILTERS: TorrentFilters = { status: 'all', search: '', categories: [], tags: [], trackers: [], addedSince: '' }

/** Combien de filtres avancés (hors statut et recherche) sont actifs : le badge du bouton « Filtres ». */
export function advancedFilterCount(filters: TorrentFilters): number {
  return filters.categories.length + filters.tags.length + filters.trackers.length + (filters.addedSince ? 1 : 0)
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

export function filterTorrents(torrents: readonly TorrentWire[], filters: TorrentFilters): TorrentWire[] {
  // Les mots de la recherche peuvent être dans n'importe quel ordre, et les points des noms de release comptent comme des espaces.
  const words = normalize(filters.search).split(/[\s.]+/).filter(Boolean)
  const since = filters.addedSince ? new Date(`${filters.addedSince}T00:00:00`).getTime() / 1000 : 0
  return torrents.filter((torrent) => {
    if (!matchesStatus(torrent, filters.status)) return false
    if (words.length > 0) {
      const name = normalize(torrent.name).replace(/\./g, ' ')
      if (!words.every((word) => name.includes(word))) return false
    }
    if (filters.categories.length > 0 && !filters.categories.includes(torrent.category)) return false
    if (filters.tags.length > 0) {
      const tags = splitTags(torrent.tags)
      if (!filters.tags.every((tag) => tags.includes(tag))) return false
    }
    if (filters.trackers.length > 0 && !filters.trackers.includes(trackerName(torrent.tracker))) return false
    return !since || torrent.added_on >= since
  })
}

// --- Tri ---

export const SORT_OPTIONS = [
  { id: 'added_on', label: 'Date d’ajout' },
  { id: 'name', label: 'Nom' },
  { id: 'size', label: 'Taille' },
  { id: 'progress', label: 'Progression' },
  { id: 'amount_left', label: 'Restant' },
  { id: 'eta', label: 'Temps restant' },
  { id: 'speed', label: 'Débit total' },
  { id: 'dlspeed', label: 'Débit descendant' },
  { id: 'upspeed', label: 'Débit montant' },
  { id: 'ratio', label: 'Ratio' },
  { id: 'downloaded', label: 'Téléchargé' },
  { id: 'uploaded', label: 'Envoyé' },
  { id: 'num_seeds', label: 'Sources' },
  { id: 'num_leechs', label: 'Pairs' },
  { id: 'availability', label: 'Disponibilité' },
  { id: 'last_activity', label: 'Dernière activité' },
  { id: 'completion_on', label: 'Date de fin' },
  { id: 'category', label: 'Catégorie' },
  { id: 'priority', label: 'Priorité de file' },
] as const

export type SortKey = (typeof SORT_OPTIONS)[number]['id']
export type SortOrder = 'asc' | 'desc'

/** ∞ (8640000) et « inconnu » (-1) vont en fin de liste quel que soit l'ordre, comme dans qBit. */
const INFINITE_ETA = 8_640_000

function sortValue(torrent: TorrentWire, key: SortKey): number | string {
  switch (key) {
    case 'name':
      return torrent.name
    case 'category':
      return torrent.category
    case 'amount_left':
      return Math.max(0, torrent.size - torrent.downloaded)
    case 'speed':
      return torrent.dlspeed + torrent.upspeed
    case 'priority':
      // 0 : hors file (terminé ou forcé) ; on le range après les positions.
      return torrent.priority > 0 ? torrent.priority : Number.MAX_SAFE_INTEGER
    default:
      return torrent[key]
  }
}

export function sortTorrents(torrents: readonly TorrentWire[], key: SortKey, order: SortOrder): TorrentWire[] {
  const direction = order === 'asc' ? 1 : -1
  return [...torrents].sort((a, b) => {
    if (key === 'eta') {
      const lastA = a.eta < 0 || a.eta >= INFINITE_ETA
      const lastB = b.eta < 0 || b.eta >= INFINITE_ETA
      if (lastA !== lastB) return lastA ? 1 : -1
    }
    const left = sortValue(a, key)
    const right = sortValue(b, key)
    const compared = typeof left === 'string' && typeof right === 'string' ? left.localeCompare(right, 'fr', { numeric: true }) : Number(left) - Number(right)
    return compared * direction || a.name.localeCompare(b.name, 'fr')
  })
}

// --- Colonnes ---

export const COLUMN_OPTIONS = [
  { id: 'status', label: 'Statut' },
  { id: 'progress', label: 'Progression' },
  { id: 'speeds', label: 'Débits' },
  { id: 'transfer', label: 'Téléchargé / envoyé' },
  { id: 'ratio', label: 'Ratio' },
  { id: 'peers', label: 'Sources / pairs' },
  { id: 'availability', label: 'Disponibilité' },
  { id: 'eta', label: 'Temps restant' },
  { id: 'tracker', label: 'Tracker' },
  { id: 'category', label: 'Catégorie' },
  { id: 'tags', label: 'Tags' },
  { id: 'added_on', label: 'Date d’ajout' },
  { id: 'completion_on', label: 'Date de fin' },
  { id: 'last_activity', label: 'Dernière activité' },
] as const

export type ColumnId = (typeof COLUMN_OPTIONS)[number]['id']

export const DEFAULT_COLUMNS: ColumnId[] = ['status', 'progress', 'speeds', 'ratio', 'eta', 'tracker', 'category']

// --- Mises en forme ---

const SPEED_UNITS = ['o/s', 'Ko/s', 'Mo/s', 'Go/s']

export function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond <= 0) return '0 o/s'
  const exponent = Math.min(SPEED_UNITS.length - 1, Math.floor(Math.log(bytesPerSecond) / Math.log(1024)))
  const value = bytesPerSecond / 1024 ** exponent
  return `${value.toLocaleString('fr-FR', { maximumFractionDigits: value < 10 ? 1 : 0 })} ${SPEED_UNITS[exponent]}`
}

/** « 2 h 05 », « 3 j 4 h », « ∞ ». */
export function formatEta(seconds: number): string {
  if (seconds < 0 || seconds >= INFINITE_ETA) return '∞'
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ${String(minutes % 60).padStart(2, '0')}`
  return `${Math.floor(hours / 24)} j ${hours % 24} h`
}

export function formatRatio(ratio: number): string {
  return ratio < 0 ? '∞' : ratio.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Les envois de la session, par tracker (la carte « Session » de MediaHub). */
export function sessionByTracker(torrents: readonly TorrentWire[]): { tracker: string; uploaded: number; downloaded: number; count: number }[] {
  const totals = new Map<string, { uploaded: number; downloaded: number; count: number }>()
  for (const torrent of torrents) {
    const name = trackerName(torrent.tracker)
    const entry = totals.get(name) ?? { uploaded: 0, downloaded: 0, count: 0 }
    entry.uploaded += torrent.uploaded_session
    entry.downloaded += torrent.downloaded_session
    entry.count += 1
    totals.set(name, entry)
  }
  return [...totals]
    .map(([tracker, entry]) => ({ tracker, ...entry }))
    .sort((a, b) => b.uploaded - a.uploaded || b.downloaded - a.downloaded)
}
