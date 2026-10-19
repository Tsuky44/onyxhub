import 'server-only'
import { errorMessage } from '../http'
import { openRequests } from './repository'
import { refreshStatuses } from './sync'

/**
 * Le filet de sécurité des webhooks : toutes les 5 minutes, les demandes
 * ouvertes sont comparées à Radarr/Sonarr. Sans demande ouverte, le tour ne
 * coûte qu'une requête SQLite ; avec, il réutilise l'index de bibliothèque
 * (60 s) partagé avec les pages.
 */
const INTERVAL_MS = 5 * 60_000
/** Après des échecs répétés (Radarr éteint…), on espace jusqu'à 30 minutes. */
const MAX_INTERVAL_MS = 30 * 60_000

const globalForPoller = globalThis as unknown as { onyxhubRequestPoller?: { timer: NodeJS.Timeout } }

export function startRequestPoller(): void {
  // Un seul poller par process, même quand Next recharge les modules en dev.
  if (globalForPoller.onyxhubRequestPoller) return
  let delay = INTERVAL_MS

  const tick = async () => {
    try {
      const rows = openRequests()
      if (rows.length > 0) await refreshStatuses(rows)
      delay = INTERVAL_MS
    } catch (error) {
      delay = Math.min(delay * 2, MAX_INTERVAL_MS)
      console.warn(`[demandes] mise à jour des statuts : ${errorMessage(error)}`)
    }
    schedule()
  }

  const schedule = () => {
    const timer = setTimeout(() => void tick(), delay)
    // Le poller ne retient pas le process à l'arrêt.
    timer.unref()
    globalForPoller.onyxhubRequestPoller = { timer }
  }

  schedule()
}
