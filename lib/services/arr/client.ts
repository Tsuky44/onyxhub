import 'server-only'
import { request, requestJson, withQuery, type QueryValue } from '../../http'
import { TtlCache } from '../../ttl-cache'

/**
 * Le client commun à Radarr, Sonarr et Prowlarr : même authentification
 * (`X-Api-Key`), même format d'erreur, mêmes commandes. Chaque service ne
 * garde que ce qui lui est propre.
 */
export interface ArrConfig {
  baseUrl: string
  apiKey: string
}

export interface ArrClient {
  get<T>(path: string, params?: Record<string, QueryValue>): Promise<T>
  /** `get` mis en cache 10 min : profils de qualité, dossiers racines… */
  getStatic<T>(path: string): Promise<T>
  post<T>(path: string, body: unknown, timeoutMs?: number): Promise<T>
  put<T>(path: string, body: unknown, timeoutMs?: number): Promise<T>
  delete(path: string, params?: Record<string, QueryValue>): Promise<void>
  /** Lance une commande (`MoviesSearch`, `SeasonSearch`…). L'*arr la met en file et répond tout de suite. */
  command(name: string, body?: Record<string, unknown>): Promise<void>
}

/** Les écritures (ajout d'une série et de ses épisodes) peuvent être lentes sur une grosse instance. */
const WRITE_TIMEOUT_MS = 60_000

const staticCache = new TtlCache<unknown>(10 * 60_000, 100)

export function createArrClient(service: string, apiVersion: 'v1' | 'v3', config: ArrConfig): ArrClient {
  const root = `${config.baseUrl}/api/${apiVersion}`
  const headers = { 'X-Api-Key': config.apiKey, Accept: 'application/json' }
  const jsonHeaders = { ...headers, 'Content-Type': 'application/json' }

  function send<T>(method: 'POST' | 'PUT', path: string, body: unknown, timeoutMs: number): Promise<T> {
    return requestJson<T>(service, `${root}${path}`, {
      method,
      headers: jsonHeaders,
      body: JSON.stringify(body),
      timeoutMs,
      readErrorDetail: true,
    })
  }

  const client: ArrClient = {
    get<T>(path: string, params: Record<string, QueryValue> = {}): Promise<T> {
      return requestJson<T>(service, withQuery(`${root}${path}`, params), { headers, readErrorDetail: true })
    },
    getStatic<T>(path: string): Promise<T> {
      // La clé inclut l'URL de base : deux instances, ou une URL corrigée, ne se mélangent pas.
      return staticCache.load(`${root}${path}`, () => client.get<T>(path)) as Promise<T>
    },
    post: (path, body, timeoutMs = WRITE_TIMEOUT_MS) => send('POST', path, body, timeoutMs),
    put: (path, body, timeoutMs = WRITE_TIMEOUT_MS) => send('PUT', path, body, timeoutMs),
    async delete(path, params = {}) {
      await request(service, withQuery(`${root}${path}`, params), { method: 'DELETE', headers, readErrorDetail: true })
    },
    async command(name, body = {}) {
      await send('POST', '/command', { name, ...body }, 15_000)
    },
  }
  return client
}

/** La version d'une instance (bouton « Tester »). */
export async function arrVersion(client: ArrClient): Promise<string | null> {
  const status = await client.get<{ version?: string }>('/system/status')
  return status.version ?? null
}

export function clearArrCache(): void {
  staticCache.clear()
}
