import 'server-only'
import { getSetting } from '../../settings/store'
import { createQbittorrent, qbittorrentConfig, type QbitConfig } from './client'
import { applyMainData, emptySyncState, type SyncState } from './sync-state'

/**
 * L'état qBittorrent en direct, partagé par tout OnyxHub : un seul poller sur
 * `sync/maindata` (différentiel, grâce au `rid`), quel que soit le nombre de
 * pages ouvertes.
 *
 * Repris de `qbittorrent-cache.ts` de MediaHub, avec deux différences :
 * - le poller **dort** quand personne n'est abonné (MediaHub interrogeait qBit
 *   toutes les 5 s, jour et nuit) ; une lecture ponctuelle (`snapshot`) fait
 *   un seul appel si l'état a vieilli ;
 * - un échec ralentit le rythme (jusqu'à 60 s) au lieu de marteler un qBit arrêté.
 */
export type LiveListener = (state: SyncState) => void

const MIN_INTERVAL_MS = 2_000
const MAX_BACKOFF_MS = 60_000
/** Délai avant de s'endormir quand le dernier abonné part (navigation entre deux pages). */
const IDLE_GRACE_MS = 30_000

function intervalMs(): number {
  const seconds = Number.parseInt(getSetting('qbittorrent_poll_interval') ?? '5', 10)
  return Math.max(MIN_INTERVAL_MS, (Number.isFinite(seconds) ? seconds : 5) * 1_000)
}

function configKey(config: QbitConfig | null): string {
  return config ? `${config.baseUrl}|${config.username}|${config.password}` : ''
}

export class QbitLive {
  private state: SyncState = emptySyncState()
  private listeners = new Set<LiveListener>()
  private timer: ReturnType<typeof setTimeout> | null = null
  private idleTimer: ReturnType<typeof setTimeout> | null = null
  private inFlight: Promise<SyncState> | null = null
  private failures = 0
  private lastError: string | null = null
  private key = ''

  /** S'abonne aux changements. Le premier abonné réveille le poller. Renvoie la fonction de désabonnement. */
  subscribe(listener: LiveListener): () => void {
    this.listeners.add(listener)
    if (this.idleTimer) {
      clearTimeout(this.idleTimer)
      this.idleTimer = null
    }
    if (!this.timer && !this.inFlight) void this.tick()
    return () => {
      this.listeners.delete(listener)
      if (this.listeners.size === 0) this.idleTimer = setTimeout(() => this.sleep(), IDLE_GRACE_MS)
    }
  }

  /**
   * L'état courant, rafraîchi d'un appel s'il a plus d'un intervalle.
   * Pour le rendu serveur (accueil, fiche média) sans abonnement.
   */
  async snapshot(): Promise<SyncState> {
    if (Date.now() - this.state.updatedAt < intervalMs()) return this.state
    return this.refresh()
  }

  /** La dernière erreur de qBit, ou `null` si le dernier appel a réussi. */
  error(): string | null {
    return this.lastError
  }

  /** Force un appel tout de suite (après une action : pause, suppression…). */
  refresh(): Promise<SyncState> {
    this.inFlight ??= this.sync().finally(() => {
      this.inFlight = null
    })
    return this.inFlight
  }

  private async sync(): Promise<SyncState> {
    const config = qbittorrentConfig()
    const key = configKey(config)
    // Adresse ou identifiants changés dans Réglages : on repart d'un état vide et d'un `rid` à 0.
    if (key !== this.key) {
      this.key = key
      this.state = emptySyncState()
    }
    const previousError = this.lastError
    let changed = false
    if (!config) {
      this.lastError = 'qBittorrent n\'est pas configuré'
    } else {
      try {
        const data = await createQbittorrent(config).mainData(this.state.rid)
        const applied = applyMainData(this.state, data)
        this.state = applied.state
        changed = applied.changed
        this.failures = 0
        this.lastError = null
      } catch (error) {
        this.failures += 1
        this.lastError = error instanceof Error ? error.message : 'qBittorrent ne répond pas'
        // Un `rid` peut devenir invalide (redémarrage de qBit) : on redemande un état complet.
        this.state = { ...this.state, rid: 0 }
      }
    }
    // Une panne (ou son retour) se signale aussi : la page l'affiche sans attendre qu'un torrent change.
    if (changed || this.lastError !== previousError) for (const listener of this.listeners) listener(this.state)
    return this.state
  }

  private async tick(): Promise<void> {
    await this.refresh()
    if (this.listeners.size === 0) return
    const backoff = this.failures > 0 ? Math.min(MAX_BACKOFF_MS, intervalMs() * 2 ** this.failures) : intervalMs()
    this.timer = setTimeout(() => {
      this.timer = null
      void this.tick()
    }, backoff)
  }

  private sleep(): void {
    this.idleTimer = null
    if (this.listeners.size > 0) return
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }
}

// En dev, Next recharge les modules : sans ce singleton global, chaque
// rechargement lancerait un poller de plus.
const globalForLive = globalThis as unknown as { onyxhubQbitLive?: QbitLive }

export function qbitLive(): QbitLive {
  globalForLive.onyxhubQbitLive ??= new QbitLive()
  return globalForLive.onyxhubQbitLive
}
