'use server'

import { requireAdmin } from '@/lib/auth/viewer'
import { parseHashes as hashesFrom } from '@/lib/downloads/hashes'
import { errorMessage } from '@/lib/http'
import { getQbittorrent } from '@/lib/services/qbittorrent/client'
import { qbitLive } from '@/lib/services/qbittorrent/live'
import type { PriorityMove } from '@/lib/services/qbittorrent/types'

export type ActionResult = { ok: true; message: string } | { ok: false; message: string }

const MAX_TORRENT_BYTES = 10 * 1024 * 1024

const count = (hashes: readonly string[]) => (hashes.length > 1 ? `${hashes.length} torrents` : 'Le torrent')

async function run(work: () => Promise<string>): Promise<ActionResult> {
  await requireAdmin()
  try {
    const message = await work()
    // La liste se met à jour tout de suite, sans attendre le prochain passage du poller.
    void qbitLive().refresh()
    return { ok: true, message }
  } catch (error) {
    return { ok: false, message: errorMessage(error) }
  }
}

const INVALID: ActionResult = { ok: false, message: 'Aucun torrent valide sélectionné.' }

export type TorrentCommand = 'pause' | 'resume' | 'reannounce' | PriorityMove

const COMMAND_MESSAGES: Record<TorrentCommand, (hashes: string[]) => string> = {
  pause: (hashes) => `${count(hashes)} ${hashes.length > 1 ? 'sont' : 'est'} en pause.`,
  resume: (hashes) => `${count(hashes)} ${hashes.length > 1 ? 'reprennent' : 'reprend'}.`,
  reannounce: (hashes) => `${count(hashes)} ${hashes.length > 1 ? 'sont réannoncés' : 'est réannoncé'} aux trackers.`,
  top: () => 'Placé en tête de file.',
  up: () => 'Monté dans la file.',
  down: () => 'Descendu dans la file.',
  bottom: () => 'Placé en fin de file.',
}

export async function torrentCommandAction(input: string[], command: TorrentCommand): Promise<ActionResult> {
  const hashes = hashesFrom(input)
  if (!hashes || !(command in COMMAND_MESSAGES)) return INVALID
  return run(async () => {
    const qbit = getQbittorrent()
    if (command === 'pause') await qbit.pause(hashes)
    else if (command === 'resume') await qbit.resume(hashes)
    else if (command === 'reannounce') await qbit.reannounce(hashes)
    else await qbit.priority(hashes, command)
    return COMMAND_MESSAGES[command](hashes)
  })
}

export async function deleteTorrentsAction(input: string[], deleteFiles: boolean): Promise<ActionResult> {
  const hashes = hashesFrom(input)
  if (!hashes) return INVALID
  return run(async () => {
    await getQbittorrent().delete(hashes, deleteFiles === true)
    const what = hashes.length > 1 ? `${hashes.length} torrents supprimés` : 'Torrent supprimé'
    return deleteFiles ? `${what}, fichiers compris.` : `${what} (fichiers gardés).`
  })
}

/**
 * Limites de partage : -2 suit le réglage global de qBit, -1 n'en met
 * aucune. MediaHub ne réglait que la durée ; le ratio suit le même modèle.
 */
export async function shareLimitsAction(input: string[], limits: { ratio: number; seedingMinutes: number }): Promise<ActionResult> {
  const hashes = hashesFrom(input)
  const valid = (value: unknown, max: number) => typeof value === 'number' && Number.isFinite(value) && (value === -2 || value === -1 || (value >= 0 && value <= max))
  if (!hashes || !valid(limits?.ratio, 1_000) || !valid(limits?.seedingMinutes, 10 * 525_600)) return INVALID
  return run(async () => {
    await getQbittorrent().setShareLimits(hashes, { ratio: limits.ratio, seedingMinutes: Math.round(limits.seedingMinutes) })
    return 'Limites de partage enregistrées.'
  })
}

/** Ajout par liens magnet / URL (un par ligne) et fichiers .torrent, avec catégorie, tags et démarrage en pause. */
export async function addTorrentsAction(form: FormData): Promise<ActionResult> {
  const urls = String(form.get('liens') ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^(magnet:\?|https?:\/\/)/i.test(line))
  const files = form
    .getAll('fichiers')
    .filter((file): file is File => file instanceof File && file.size > 0 && file.size <= MAX_TORRENT_BYTES && file.name.toLowerCase().endsWith('.torrent'))
  if (urls.length === 0 && files.length === 0) return { ok: false, message: 'Ajoute au moins un lien magnet ou un fichier .torrent.' }
  const category = String(form.get('categorie') ?? '').trim()
  const tags = String(form.get('tags') ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
  return run(async () => {
    await getQbittorrent().add({ urls, files, category: category || undefined, tags, paused: form.get('pause') === 'on' })
    const total = urls.length + files.length
    return total > 1 ? `${total} torrents ajoutés.` : 'Torrent ajouté.'
  })
}
