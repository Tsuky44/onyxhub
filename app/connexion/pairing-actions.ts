'use server'

import { safeNextPath } from '@/lib/auth/next-path'
import { writeSession } from '@/lib/auth/session'
import { seal, unseal } from '@/lib/crypto'
import { errorMessage, normalizeBaseUrl } from '@/lib/http'
import { onyxBaseUrl } from '@/lib/services/onyx/auth'
import { pollPairing, startPairing } from '@/lib/services/onyx/pairing'
import { getSetting } from '@/lib/settings/store'

/**
 * La connexion par l'app Onyx (ADR-0011). Le navigateur ne reçoit la poignée
 * de l'appairage que scellée par OnyxHub : il ne peut ni la lire ni la
 * présenter lui-même à Onyx, et la session reste côté serveur.
 */
export type PairingState =
  | { kind: 'started'; ticket: string; userCode: string; approveUrl: string; expiresAt: number; interval: number }
  | { kind: 'error'; message: string }

export type PairingPollResult = { kind: 'pending' } | { kind: 'expired' } | { kind: 'approved'; next: string } | { kind: 'error'; message: string }

export async function startPairingAction(): Promise<PairingState> {
  const baseUrl = onyxBaseUrl()
  if (!baseUrl) return { kind: 'error', message: 'L\'adresse du serveur Onyx n\'est pas encore connue.' }
  try {
    const pairing = await startPairing(baseUrl, 'OnyxHub (navigateur)')
    // `?tv=CODE` ouvre l'écran d'approbation de l'app web d'Onyx, déjà connectée sur ce navigateur ou sur un téléphone.
    const webBase = normalizeBaseUrl(getSetting('onyx_web_url')) ?? baseUrl
    return {
      kind: 'started',
      ticket: seal(pairing.deviceCode),
      userCode: pairing.userCode,
      approveUrl: `${webBase}/?tv=${encodeURIComponent(pairing.userCode)}`,
      expiresAt: Date.now() + pairing.expiresIn * 1000,
      interval: pairing.interval,
    }
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) }
  }
}

export async function pollPairingAction(ticket: string, suite: string): Promise<PairingPollResult> {
  const baseUrl = onyxBaseUrl()
  const deviceCode = unseal(ticket)
  if (!baseUrl || !deviceCode) return { kind: 'expired' }
  try {
    const result = await pollPairing(baseUrl, deviceCode)
    if (result.status !== 'approved') return { kind: result.status }
    await writeSession({ token: result.token, userId: result.user.id, username: result.user.username })
    return { kind: 'approved', next: safeNextPath(suite) }
  } catch (error) {
    return { kind: 'error', message: errorMessage(error) }
  }
}
