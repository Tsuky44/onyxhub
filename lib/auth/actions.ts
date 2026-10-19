'use server'

import { redirect } from 'next/navigation'
import { logoutOnyx } from '../services/onyx/auth'
import { clearSession, readSession } from './session'
import { forgetToken } from './viewer'

export async function logoutAction(): Promise<void> {
  const session = await readSession()
  if (session) {
    forgetToken(session.token)
    try {
      await logoutOnyx(session.token)
    } catch (error) {
      // Onyx injoignable : la session locale se ferme quand même, et le jeton
      // expirera côté Onyx après 90 jours sans usage.
      console.warn('[auth] déconnexion Onyx impossible', error)
    }
  }
  await clearSession()
  redirect('/connexion')
}
