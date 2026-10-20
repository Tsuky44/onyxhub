import 'server-only'
import { request, requestJson, ServiceError } from '../../http'
import type { OnyxUser } from './types'

const SERVICE = 'Onyx'

/**
 * L'appairage d'appareil d'Onyx (`/api/auth/device/*`), celui qui connecte un
 * téléviseur : OnyxHub ouvre un appairage, un téléphone déjà connecté
 * l'approuve, et OnyxHub récupère la session. Aucun mot de passe ne passe par
 * OnyxHub (ADR-0011).
 */
export interface PairingStart {
  /** La poignée privée de l'appairage : seule elle récupère la session. Ne quitte pas le serveur en clair. */
  deviceCode: string
  /** Le code court affiché, à saisir ou à ouvrir dans l'app Onyx. */
  userCode: string
  expiresIn: number
  interval: number
}

export type PairingPoll = { status: 'pending' } | { status: 'expired' } | { status: 'approved'; token: string; user: OnyxUser }

export async function startPairing(baseUrl: string, deviceName: string): Promise<PairingStart> {
  const raw = await requestJson<{ device_code?: string; user_code?: string; expires_in?: number; interval?: number }>(
    SERVICE,
    `${baseUrl}/api/auth/device/start`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ device_name: deviceName }), timeoutMs: 5_000 },
  )
  if (!raw.device_code || !raw.user_code) throw new ServiceError(SERVICE, 'Onyx n\'a pas ouvert d\'appairage')
  return { deviceCode: raw.device_code, userCode: raw.user_code, expiresIn: raw.expires_in ?? 300, interval: Math.max(2, raw.interval ?? 2) }
}

export async function pollPairing(baseUrl: string, deviceCode: string): Promise<PairingPoll> {
  const response = await request(SERVICE, `${baseUrl}/api/auth/device/poll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_code: deviceCode }),
    timeoutMs: 5_000,
  })
  const raw = (await response.json().catch(() => ({}))) as { status?: string; token?: string; user?: OnyxUser }
  if (raw.status === 'approved' && raw.token && raw.user) return { status: 'approved', token: raw.token, user: raw.user }
  // Un appairage refusé depuis le téléphone se lit comme expiré : il faut en rouvrir un.
  return raw.status === 'pending' ? { status: 'pending' } : { status: 'expired' }
}
