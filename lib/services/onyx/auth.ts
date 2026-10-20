import 'server-only'
import { normalizeBaseUrl, request, requestJson, ServiceError } from '../../http'
import { getSetting } from '../../settings/store'
import type { OnyxLoginResult, OnyxOtpChallenge, OnyxPing, OnyxUser } from './types'

const SERVICE = 'Onyx'

/** L'URL du serveur Onyx configurée, ou `null` tant qu'elle ne l'est pas. */
export function onyxBaseUrl(): string | null {
  return normalizeBaseUrl(getSetting('onyx_url'))
}

function requireBaseUrl(): string {
  const base = onyxBaseUrl()
  if (!base) throw new ServiceError(SERVICE, 'L\'adresse du serveur Onyx n\'est pas configurée')
  return base
}

/** `GET /api/ping` : publique, dit si l'adresse répond et quelle version tourne. */
export async function pingOnyx(baseUrl: string): Promise<OnyxPing> {
  const ping = await requestJson<Partial<OnyxPing>>(SERVICE, `${baseUrl}/api/ping`, { timeoutMs: 5_000 })
  if (ping.status !== 'ok') throw new ServiceError(SERVICE, 'Cette adresse répond, mais ce n\'est pas un serveur Onyx')
  const capabilities = Array.isArray(ping.capabilities) ? ping.capabilities.filter((name) => typeof name === 'string') : []
  return { status: ping.status, version: ping.version ?? 'inconnue', capabilities }
}

interface LoginBody {
  token?: string
  user?: OnyxUser
  recovery_codes?: string[]
  error?: string
  otp?: OnyxOtpChallenge
}

/**
 * Lit la réponse d'une étape de connexion. On n'utilise pas `request` ici :
 * le 401 n'est pas une panne, il porte soit « mauvais identifiants », soit
 * l'étape de 2FA.
 */
async function readLoginResponse(response: Response, rejected: string): Promise<OnyxLoginResult> {
  let body: LoginBody = {}
  try {
    body = (await response.json()) as LoginBody
  } catch {
    // Corps vide ou non JSON : on retombe sur le message selon le code HTTP.
  }
  if (response.ok && body.token && body.user) {
    return { kind: 'ok', token: body.token, user: body.user, recoveryCodes: body.recovery_codes ?? [] }
  }
  if (response.status === 401 && body.otp?.challenge) return { kind: 'otp', otp: body.otp }
  if (response.status === 401) return { kind: 'error', message: rejected }
  if (response.status === 429) return { kind: 'error', message: 'Trop de tentatives, réessaie dans un moment.' }
  return { kind: 'error', message: `Onyx a refusé la connexion (HTTP ${response.status}).` }
}

async function postLogin(path: string, payload: unknown, rejected: string): Promise<OnyxLoginResult> {
  const base = requireBaseUrl()
  let response: Response
  try {
    response = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    })
  } catch (error) {
    throw new ServiceError(SERVICE, 'Le serveur Onyx est injoignable', { cause: error })
  }
  return readLoginResponse(response, rejected)
}

export function loginWithPassword(username: string, password: string): Promise<OnyxLoginResult> {
  return postLogin('/api/auth/login', { username, password }, "Nom d'utilisateur ou mot de passe incorrect.")
}

export function loginWithOtp(challenge: string, code: string): Promise<OnyxLoginResult> {
  return postLogin('/api/auth/otp/login', { challenge, code }, 'Code incorrect ou expiré.')
}

/**
 * `GET /api/auth/me` : le compte derrière un jeton, ou `null` si Onyx ne le
 * reconnaît plus (expiré, révoqué). Une panne réseau, elle, remonte en
 * `ServiceError` : on n'invalide pas une session parce qu'Onyx redémarre.
 */
export async function fetchMe(token: string): Promise<OnyxUser | null> {
  try {
    return await requestJson<OnyxUser>(SERVICE, `${requireBaseUrl()}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      timeoutMs: 5_000,
    })
  } catch (error) {
    if (error instanceof ServiceError && (error.status === 401 || error.status === 404)) return null
    throw error
  }
}

/** Ferme la session côté Onyx. Un échec n'empêche pas la déconnexion locale. */
export async function logoutOnyx(token: string): Promise<void> {
  await request(SERVICE, `${requireBaseUrl()}/api/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    timeoutMs: 5_000,
  })
}
