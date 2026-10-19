'use server'

import { revalidatePath } from 'next/cache'
import { redirect, unstable_rethrow } from 'next/navigation'
import { safeNextPath } from '@/lib/auth/next-path'
import { writeSession } from '@/lib/auth/session'
import { errorMessage, normalizeBaseUrl } from '@/lib/http'
import { loginWithOtp, loginWithPassword, onyxBaseUrl, pingOnyx } from '@/lib/services/onyx/auth'
import type { OnyxLoginResult } from '@/lib/services/onyx/types'
import { setSettings } from '@/lib/settings/store'

export type LoginState =
  | { step: 'password'; error?: string; username?: string }
  | { step: 'otp'; challenge: string; setup: boolean; secret?: string; uri?: string; error?: string }
  | { step: 'recovery'; codes: string[]; next: string }

function field(form: FormData, name: string): string {
  const value = form.get(name)
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Premier démarrage sans `ONYX_URL` : l'adresse saisie sur la page de
 * connexion est enregistrée une fois qu'elle répond comme un serveur Onyx.
 * Ensuite, seul un admin la change, depuis Réglages.
 */
async function ensureServer(form: FormData): Promise<string | null> {
  if (onyxBaseUrl()) return null
  const server = normalizeBaseUrl(field(form, 'server'))
  if (!server) return 'Indique l\'adresse de ton serveur Onyx (http://… ou https://…).'
  try {
    await pingOnyx(server)
  } catch (error) {
    return errorMessage(error)
  }
  setSettings({ onyx_url: server })
  // La page se re-rend sans le champ d'adresse, désormais enregistrée.
  revalidatePath('/connexion')
  return null
}

async function finish(result: OnyxLoginResult, next: string, otpStep?: Extract<LoginState, { step: 'otp' }>): Promise<LoginState> {
  if (result.kind === 'otp') return { step: 'otp', ...result.otp }
  if (result.kind === 'error') return otpStep ? { ...otpStep, error: result.message } : { step: 'password', error: result.message }

  await writeSession({ token: result.token, userId: result.user.id, username: result.user.username })
  // Codes de secours d'une 2FA configurée pendant cette connexion : Onyx ne
  // les montre qu'une fois, on s'arrête pour les afficher avant de continuer.
  if (result.recoveryCodes.length > 0) return { step: 'recovery', codes: result.recoveryCodes, next }
  redirect(next)
}

export async function loginAction(previous: LoginState, form: FormData): Promise<LoginState> {
  const next = safeNextPath(form.get('suite'))

  try {
    if (previous.step === 'otp') {
      const code = field(form, 'code').replace(/\s+/g, '')
      if (!code) return { ...previous, error: 'Saisis le code à 6 chiffres, ou un code de secours.' }
      return await finish(await loginWithOtp(previous.challenge, code), next, previous)
    }

    const username = field(form, 'username')
    const serverError = await ensureServer(form)
    if (serverError) return { step: 'password', error: serverError, username }

    const password = typeof form.get('password') === 'string' ? (form.get('password') as string) : ''
    if (!username || !password) {
      return { step: 'password', error: 'Saisis ton nom d\'utilisateur et ton mot de passe Onyx.', username }
    }
    const result = await loginWithPassword(username, password)
    if (result.kind === 'error') return { step: 'password', error: result.message, username }
    return await finish(result, next)
  } catch (error) {
    // `redirect()` lance une exception que Next doit recevoir telle quelle.
    unstable_rethrow(error)
    const message = errorMessage(error)
    return previous.step === 'otp' ? { ...previous, error: message } : { step: 'password', error: message, username: field(form, 'username') }
  }
}
