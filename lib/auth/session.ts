import 'server-only'
import { cookies, headers } from 'next/headers'
import { seal, unseal } from '../crypto'

/**
 * Le cookie de session : le jeton Onyx et l'identité du compte, chiffrés et
 * authentifiés (AES-GCM). Le navigateur ne peut ni le lire ni le modifier, et
 * le jeton Onyx ne quitte jamais le serveur d'OnyxHub.
 */
export const SESSION_COOKIE = 'onyxhub_session'

/** Comme Onyx : une session vit tant qu'elle sert au moins une fois tous les 90 jours. */
const MAX_AGE_SECONDS = 90 * 24 * 60 * 60

export interface Session {
  token: string
  userId: number
  username: string
}

function isSession(value: unknown): value is Session {
  const candidate = value as Partial<Session> | null
  return typeof candidate?.token === 'string' && typeof candidate.userId === 'number' && typeof candidate.username === 'string'
}

export function decodeSession(raw: string | undefined): Session | null {
  if (!raw) return null
  const json = unseal(raw)
  if (!json) return null
  try {
    const parsed: unknown = JSON.parse(json)
    return isSession(parsed) ? parsed : null
  } catch {
    // Contenu déchiffré mais pas du JSON : impossible sans bug, traité comme absent.
    return null
  }
}

export async function readSession(): Promise<Session | null> {
  return decodeSession((await cookies()).get(SESSION_COOKIE)?.value)
}

/**
 * `Secure` seulement derrière HTTPS : un OnyxHub servi en HTTP sur le réseau
 * local doit pouvoir poser son cookie, sinon personne ne se connecte.
 */
async function isHttps(): Promise<boolean> {
  const h = await headers()
  const proto = h.get('x-forwarded-proto')?.split(',')[0]?.trim()
  return proto === 'https'
}

/** À appeler depuis une server action ou une route. */
export async function writeSession(session: Session): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE, seal(JSON.stringify(session)), {
    httpOnly: true,
    sameSite: 'lax',
    secure: await isHttps(),
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  })
}

export async function clearSession(): Promise<void> {
  ;(await cookies()).delete(SESSION_COOKIE)
}
