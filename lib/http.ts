import 'server-only'

/**
 * Le seul chemin des appels HTTP sortants (Onyx, TMDB, Radarr, Sonarr, qBit,
 * Prowlarr). MediaHub avait des `fetch` et des instances axios éparpillés,
 * chacun avec son délai (ou aucun) et ses messages : ici, un délai par appel,
 * et des erreurs qui disent quoi faire sans jamais contenir de clé ni d'URL
 * complète.
 */
export class ServiceError extends Error {
  readonly service: string
  readonly status: number | null

  constructor(service: string, message: string, options: { status?: number; cause?: unknown } = {}) {
    super(message, { cause: options.cause })
    this.name = 'ServiceError'
    this.service = service
    this.status = options.status ?? null
  }
}

export interface RequestOptions extends Omit<RequestInit, 'signal'> {
  /** Délai total de l'appel. 10 s par défaut. */
  timeoutMs?: number
}

/** Une URL de base propre (`http(s)://hôte[:port][/chemin]`, sans `/` final), ou `null` si elle ne l'est pas. */
export function normalizeBaseUrl(raw: string | undefined | null): string | null {
  const value = raw?.trim()
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    url.search = ''
    url.hash = ''
    return url.toString().replace(/\/+$/, '')
  } catch {
    // Pas une URL : l'appelant affiche « URL invalide », rien d'autre à faire.
    return null
  }
}

function statusMessage(status: number): string {
  if (status === 401 || status === 403) return 'accès refusé : vérifie la clé ou les identifiants'
  if (status === 404) return 'adresse introuvable : vérifie l\'URL (et son chemin de base)'
  if (status === 429) return 'trop de requêtes, réessaie dans un moment'
  if (status >= 500) return `erreur du service (HTTP ${status})`
  return `réponse inattendue (HTTP ${status})`
}

/** Lance l'appel et rejette tout ce qui n'est pas 2xx par une `ServiceError` lisible. */
export async function request(service: string, url: string, options: RequestOptions = {}): Promise<Response> {
  const { timeoutMs = 10_000, ...init } = options
  let response: Response
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' })
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === 'TimeoutError'
    throw new ServiceError(service, timedOut ? `${service} ne répond pas (délai dépassé)` : `${service} est injoignable`, { cause: error })
  }
  if (!response.ok) {
    // Le corps n'est pas relu : il peut contenir l'URL appelée, donc la clé.
    await response.body?.cancel()
    throw new ServiceError(service, `${service} : ${statusMessage(response.status)}`, { status: response.status })
  }
  return response
}

/** `request`, puis le corps lu en JSON. */
export async function requestJson<T>(service: string, url: string, options: RequestOptions = {}): Promise<T> {
  const response = await request(service, url, options)
  try {
    return (await response.json()) as T
  } catch (error) {
    throw new ServiceError(service, `${service} a renvoyé une réponse illisible`, { cause: error })
  }
}

/** Le message à montrer pour une erreur quelconque : celui d'une `ServiceError`, un générique sinon. */
export function errorMessage(error: unknown): string {
  return error instanceof ServiceError ? error.message : 'Erreur inattendue, réessaie.'
}
