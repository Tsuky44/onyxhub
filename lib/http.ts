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

/** Un service dont les réglages manquent : l'appelant affiche « à configurer dans Réglages ». */
export class NotConfiguredError extends ServiceError {
  constructor(service: string) {
    super(service, `${service} n'est pas configuré : renseigne-le dans Réglages`)
    this.name = 'NotConfiguredError'
  }
}

export type QueryValue = string | number | boolean | null | undefined | readonly (string | number)[]

/**
 * Ajoute des paramètres à une URL. Les valeurs vides sont omises, et un
 * tableau répète la clé (`categories=2000&categories=5000`) : c'est ce
 * qu'attendent Prowlarr et les *arr, là où MediaHub joignait parfois par des
 * virgules que l'API ignorait.
 */
export function withQuery(url: string, params: Record<string, QueryValue>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) for (const item of value) search.append(key, String(item))
    else search.append(key, String(value))
  }
  const query = search.toString()
  if (!query) return url
  return `${url}${url.includes('?') ? '&' : '?'}${query}`
}

export interface RequestOptions extends Omit<RequestInit, 'signal'> {
  /** Délai total de l'appel. 10 s par défaut. */
  timeoutMs?: number
  /**
   * Lire le message d'erreur du service (validation Radarr/Sonarr…). Réservé
   * aux services authentifiés par en-tête : leur corps d'erreur ne peut pas
   * contenir la clé, qui n'est pas dans l'URL.
   */
  readErrorDetail?: boolean
}

/** Le message lisible d'un corps d'erreur `{ message }` ou `[{ errorMessage }]` (format des *arr), tronqué. */
export function errorDetailFrom(body: string): string | null {
  try {
    const parsed: unknown = JSON.parse(body)
    const first = Array.isArray(parsed) ? parsed[0] : parsed
    const record = first as { errorMessage?: unknown; message?: unknown; detail?: unknown } | null
    // `detail` : le format problem+json de sorraa.
    const message =
      typeof record?.errorMessage === 'string' ? record.errorMessage : typeof record?.message === 'string' ? record.message : typeof record?.detail === 'string' ? record.detail : null
    return message ? message.slice(0, 200) : null
  } catch {
    // Corps non JSON (page HTML d'un proxy…) : rien d'utile à montrer.
    return null
  }
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
  const { timeoutMs = 10_000, readErrorDetail = false, ...init } = options
  let response: Response
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' })
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === 'TimeoutError'
    throw new ServiceError(service, timedOut ? `${service} ne répond pas (délai dépassé)` : `${service} est injoignable`, { cause: error })
  }
  if (!response.ok) {
    const detail = readErrorDetail ? errorDetailFrom(await response.text().catch(() => '')) : null
    // Sinon le corps n'est pas relu : il peut contenir l'URL appelée, donc la clé.
    if (!readErrorDetail) await response.body?.cancel()
    // Un refus d'accès garde le message générique, qui dit quoi vérifier.
    const useDetail = detail && response.status !== 401 && response.status !== 403
    const message = useDetail ? `${service} : ${detail}` : `${service} : ${statusMessage(response.status)}`
    throw new ServiceError(service, message, { status: response.status })
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
