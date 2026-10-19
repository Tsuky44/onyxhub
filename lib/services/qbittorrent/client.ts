import 'server-only'
import { NotConfiguredError, normalizeBaseUrl, request, ServiceError, withQuery, type QueryValue } from '../../http'
import { getSetting } from '../../settings/store'
import type {
  AddTorrentInput,
  Category,
  MainData,
  PriorityMove,
  Torrent,
  TorrentFile,
  TorrentPeer,
  TorrentProperties,
  TorrentTracker,
  TransferInfo,
} from './types'

const SERVICE = 'qBittorrent'

export interface QbitConfig {
  baseUrl: string
  username: string
  password: string
}

export interface Qbittorrent {
  version(): Promise<string>
  mainData(rid: number): Promise<MainData>
  torrents(): Promise<Torrent[]>
  properties(hash: string): Promise<TorrentProperties>
  files(hash: string): Promise<TorrentFile[]>
  trackers(hash: string): Promise<TorrentTracker[]>
  peers(hash: string): Promise<TorrentPeer[]>
  transferInfo(): Promise<TransferInfo>
  categories(): Promise<Record<string, Category>>
  tags(): Promise<string[]>
  add(input: AddTorrentInput): Promise<void>
  delete(hashes: readonly string[], deleteFiles: boolean): Promise<void>
  pause(hashes: readonly string[]): Promise<void>
  resume(hashes: readonly string[]): Promise<void>
  priority(hashes: readonly string[], move: PriorityMove): Promise<void>
  reannounce(hashes: readonly string[]): Promise<void>
  setShareLimits(hashes: readonly string[], limits: { ratio: number; seedingMinutes: number; inactiveSeedingMinutes?: number }): Promise<void>
}

/**
 * La session qBit (cookie `SID`) et la version de l'API, partagées par toutes
 * les instances qui visent la même adresse avec le même compte : le poller et
 * les actions de la page ne se connectent qu'une fois.
 */
interface Session {
  sid: string | null
  loggedIn: boolean
  webApiVersion: number[] | null
  login: Promise<void> | null
}

const globalForQbit = globalThis as unknown as { onyxhubQbitSessions?: Map<string, Session> }
const sessions = (globalForQbit.onyxhubQbitSessions ??= new Map<string, Session>())

function sessionFor(config: QbitConfig): Session {
  const key = `${config.baseUrl}|${config.username}`
  let session = sessions.get(key)
  if (!session) {
    session = { sid: null, loggedIn: false, webApiVersion: null, login: null }
    sessions.set(key, session)
  }
  return session
}

/** `2.11.2` → `[2, 11, 2]`, comparable élément par élément. */
export function parseVersion(raw: string): number[] {
  return raw
    .trim()
    .replace(/^v/, '')
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0)
}

export function versionAtLeast(version: readonly number[], minimum: readonly number[]): boolean {
  for (let index = 0; index < minimum.length; index++) {
    const left = version[index] ?? 0
    const right = minimum[index] ?? 0
    if (left !== right) return left > right
  }
  return true
}

/**
 * `isolated` : une session à part, jamais partagée. Pour le bouton « Tester » :
 * avec la session commune, un mot de passe faux passerait le test tant que
 * l'ancienne session reste ouverte.
 */
export function createQbittorrent(config: QbitConfig, { isolated = false }: { isolated?: boolean } = {}): Qbittorrent {
  const session: Session = isolated ? { sid: null, loggedIn: false, webApiVersion: null, login: null } : sessionFor(config)
  const root = `${config.baseUrl}/api/v2`
  // qBit refuse une requête dont le Referer/Origin ne correspond pas à son hôte (protection CSRF).
  const baseHeaders = { Referer: `${config.baseUrl}/` }

  async function login(): Promise<void> {
    // Sans utilisateur, qBit est censé dispenser ce réseau d'authentification :
    // pas de tentative de connexion (qui compterait comme un échec et pourrait
    // faire bannir l'IP d'OnyxHub après quelques essais).
    if (!config.username) {
      session.loggedIn = true
      return
    }
    session.login ??= (async () => {
      try {
        const response = await request(SERVICE, `${root}/auth/login`, {
          method: 'POST',
          headers: { ...baseHeaders, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ username: config.username, password: config.password }),
        })
        if ((await response.text()).trim() !== 'Ok.') throw new ServiceError(SERVICE, 'qBittorrent : identifiants refusés')
        // Pas de cookie quand qBit dispense ce réseau d'authentification : les appels passent sans.
        session.sid = response.headers.get('set-cookie')?.match(/SID=[^;]+/)?.[0] ?? null
        session.loggedIn = true
      } finally {
        session.login = null
      }
    })()
    return session.login
  }

  async function call(path: string, init: { method?: 'GET' | 'POST'; query?: Record<string, QueryValue>; body?: BodyInit } = {}): Promise<Response> {
    if (!session.loggedIn) await login()
    const send = () =>
      request(SERVICE, withQuery(`${root}${path}`, init.query ?? {}), {
        method: init.method ?? 'GET',
        headers: { ...baseHeaders, ...(session.sid ? { Cookie: session.sid } : {}) },
        body: init.body,
      })
    try {
      return await send()
    } catch (error) {
      // 403 : la session a expiré (redémarrage de qBit, délai d'inactivité). Une reconnexion, un seul nouvel essai.
      if (error instanceof ServiceError && error.status === 403) {
        session.loggedIn = false
        await login()
        return send()
      }
      throw error
    }
  }

  const json = async <T>(path: string, query?: Record<string, QueryValue>): Promise<T> => (await call(path, { query })).json() as Promise<T>
  const post = async (path: string, fields: Record<string, string>): Promise<void> => {
    await call(path, { method: 'POST', body: new URLSearchParams(fields) })
  }
  const hashList = (hashes: readonly string[]) => (hashes.length ? hashes.join('|') : 'all')

  async function webApiVersion(): Promise<number[]> {
    session.webApiVersion ??= parseVersion(await (await call('/app/webapiVersion')).text())
    return session.webApiVersion
  }

  /** qBit 5 (API 2.11) a renommé pause/resume en stop/start ; l'ancien nom répond 404. */
  async function pauseResume(kind: 'pause' | 'resume', hashes: readonly string[]): Promise<void> {
    const modern = versionAtLeast(await webApiVersion(), [2, 11])
    const path = kind === 'pause' ? (modern ? '/torrents/stop' : '/torrents/pause') : modern ? '/torrents/start' : '/torrents/resume'
    await post(path, { hashes: hashList(hashes) })
  }

  const PRIORITY_PATHS: Record<PriorityMove, string> = {
    top: '/torrents/topPrio',
    up: '/torrents/increasePrio',
    down: '/torrents/decreasePrio',
    bottom: '/torrents/bottomPrio',
  }

  return {
    version: async () => (await (await call('/app/version')).text()).trim(),
    mainData: (rid) => json('/sync/maindata', { rid }),
    torrents: () => json('/torrents/info'),
    properties: (hash) => json('/torrents/properties', { hash }),
    files: (hash) => json('/torrents/files', { hash }),
    trackers: (hash) => json('/torrents/trackers', { hash }),
    peers: async (hash) => Object.values((await json<{ peers?: Record<string, TorrentPeer> }>('/sync/torrentPeers', { hash, rid: 0 })).peers ?? {}),
    transferInfo: () => json('/transfer/info'),
    categories: () => json('/torrents/categories'),
    tags: () => json('/torrents/tags'),
    async add(input) {
      if (!input.urls?.length && !input.files?.length) throw new ServiceError(SERVICE, 'Ajoute un lien magnet ou un fichier .torrent')
      const form = new FormData()
      if (input.urls?.length) form.append('urls', input.urls.join('\n'))
      for (const file of input.files ?? []) form.append('torrents', file, file.name)
      if (input.category) form.append('category', input.category)
      if (input.tags?.length) form.append('tags', input.tags.join(','))
      if (input.savePath) form.append('savepath', input.savePath)
      // `paused` avant qBit 5, `stopped` ensuite : on envoie les deux, chacun ignore l'autre.
      if (input.paused) {
        form.append('paused', 'true')
        form.append('stopped', 'true')
      }
      const response = await call('/torrents/add', { method: 'POST', body: form })
      if ((await response.text()).trim() === 'Fails.') throw new ServiceError(SERVICE, 'qBittorrent a refusé ce torrent (lien ou fichier invalide)')
    },
    delete: (hashes, deleteFiles) => post('/torrents/delete', { hashes: hashList(hashes), deleteFiles: String(deleteFiles) }),
    pause: (hashes) => pauseResume('pause', hashes),
    resume: (hashes) => pauseResume('resume', hashes),
    priority: (hashes, move) => post(PRIORITY_PATHS[move], { hashes: hashList(hashes) }),
    reannounce: (hashes) => post('/torrents/reannounce', { hashes: hashList(hashes) }),
    setShareLimits: (hashes, limits) =>
      post('/torrents/setShareLimits', {
        hashes: hashList(hashes),
        ratioLimit: String(limits.ratio),
        seedingTimeLimit: String(limits.seedingMinutes),
        inactiveSeedingTimeLimit: String(limits.inactiveSeedingMinutes ?? -1),
      }),
  }
}

/** La configuration qBit de Réglages, ou `null` si l'URL manque. */
export function qbittorrentConfig(): QbitConfig | null {
  const baseUrl = normalizeBaseUrl(getSetting('qbittorrent_url'))
  if (!baseUrl) return null
  return { baseUrl, username: getSetting('qbittorrent_username') ?? '', password: getSetting('qbittorrent_password') ?? '' }
}

export function getQbittorrent(): Qbittorrent {
  const config = qbittorrentConfig()
  if (!config) throw new NotConfiguredError(SERVICE)
  return createQbittorrent(config)
}

/** Oublie les sessions (tests, changement d'identifiants). */
export function resetQbitSessions(): void {
  sessions.clear()
}
