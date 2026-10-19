import type { Category, MainData, ServerState, Torrent } from './types'

/**
 * L'état tenu à jour à partir de `sync/maindata`, et la façon de lui
 * appliquer une réponse. Fonctions pures : le poller (cache.ts) ne fait
 * qu'appeler qBit et passer le résultat ici.
 *
 * Par rapport à MediaHub, `sync/maindata` sert aussi pour les catégories et
 * les tags (il les envoie en différentiel) : plus de second minuteur à 60 s
 * pour les relire.
 */
export interface SyncState {
  rid: number
  torrents: Record<string, Torrent>
  categories: Record<string, Category>
  tags: string[]
  server: ServerState
  updatedAt: number
}

export function emptySyncState(): SyncState {
  return { rid: 0, torrents: {}, categories: {}, tags: [], server: {}, updatedAt: 0 }
}

const num = (value: unknown): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const str = (value: unknown): string => (typeof value === 'string' ? value : value == null ? '' : String(value))

/** Remplit tous les champs, avec des zéros et des chaînes vides pour ce que qBit n'a pas (encore) envoyé. */
export function normalizeTorrent(hash: string, raw: Partial<Record<keyof Torrent, unknown>>): Torrent {
  return {
    hash,
    name: str(raw.name),
    state: str(raw.state),
    progress: num(raw.progress),
    dlspeed: num(raw.dlspeed),
    upspeed: num(raw.upspeed),
    eta: num(raw.eta),
    size: num(raw.size),
    total_size: num(raw.total_size),
    downloaded: num(raw.downloaded),
    uploaded: num(raw.uploaded),
    downloaded_session: num(raw.downloaded_session),
    uploaded_session: num(raw.uploaded_session),
    ratio: num(raw.ratio),
    num_seeds: num(raw.num_seeds),
    num_leechs: num(raw.num_leechs),
    num_complete: num(raw.num_complete),
    num_incomplete: num(raw.num_incomplete),
    added_on: num(raw.added_on),
    completion_on: num(raw.completion_on),
    last_activity: num(raw.last_activity),
    seeding_time: num(raw.seeding_time),
    max_seeding_time: num(raw.max_seeding_time),
    availability: num(raw.availability),
    priority: num(raw.priority),
    category: str(raw.category),
    tags: str(raw.tags),
    tracker: str(raw.tracker),
    save_path: str(raw.save_path),
    content_path: str(raw.content_path),
    ratio_limit: num(raw.ratio_limit),
    seeding_time_limit: num(raw.seeding_time_limit),
    magnet_uri: str(raw.magnet_uri),
  }
}

/**
 * Applique une réponse. Une réponse complète remplace tout ; un différentiel
 * fusionne les champs reçus dans les torrents connus. Renvoie aussi si quelque
 * chose a changé, pour ne prévenir les abonnés qu'à bon escient.
 */
export function applyMainData(state: SyncState, data: MainData, now = Date.now()): { state: SyncState; changed: boolean } {
  const full = data.full_update === true
  const torrents: Record<string, Torrent> = full ? {} : { ...state.torrents }
  for (const [hash, patch] of Object.entries(data.torrents ?? {})) {
    const previous = full ? undefined : torrents[hash]
    torrents[hash] = normalizeTorrent(hash, previous ? { ...previous, ...patch } : patch)
  }
  for (const hash of data.torrents_removed ?? []) delete torrents[hash]

  const categories: Record<string, Category> = full ? {} : { ...state.categories }
  for (const [name, patch] of Object.entries(data.categories ?? {})) {
    categories[name] = { name, savePath: str(patch.savePath ?? categories[name]?.savePath) }
  }
  for (const name of data.categories_removed ?? []) delete categories[name]

  const removedTags = new Set(data.tags_removed ?? [])
  const tags = [...new Set([...(full ? [] : state.tags), ...(data.tags ?? [])])].filter((tag) => !removedTags.has(tag)).sort()

  const server = full ? { ...data.server_state } : { ...state.server, ...data.server_state }

  const changed =
    full ||
    Object.keys(data.torrents ?? {}).length > 0 ||
    (data.torrents_removed?.length ?? 0) > 0 ||
    Object.keys(data.categories ?? {}).length > 0 ||
    (data.categories_removed?.length ?? 0) > 0 ||
    (data.tags?.length ?? 0) > 0 ||
    removedTags.size > 0 ||
    Object.keys(data.server_state ?? {}).length > 0

  return { state: { rid: data.rid, torrents, categories, tags, server, updatedAt: now }, changed }
}
