import 'server-only'
import { and, eq, isNull, ne } from 'drizzle-orm'
import { getDb } from '../db'
import { mediaRequests } from '../db/schema'

/**
 * Les demandes suivent le compte Onyx, pas son nom (ADR-0012).
 *
 * Les demandes se retrouvent par le nom du compte (`requester`) : c'est ce que
 * MediaHub recevait, et ce que lisent la liste, le calendrier et « pour toi ».
 * Plutôt que de réécrire toutes ces lectures, chaque passage d'un compte
 * identifié (session, ou `X-Player-Id` envoyé par Onyx) :
 *   - rattache à son identifiant les demandes d'avant, faites sous son nom ;
 *   - recopie son nom actuel sur ses demandes, s'il a été renommé dans Onyx.
 *
 * Le couple (identifiant, nom) déjà vu ne coûte rien : la base n'est touchée
 * que quand il change, au plus une fois par compte et par démarrage sinon.
 */
const seen = new Map<number, string>()
const MAX_SEEN = 1_000

export function rememberRequester(id: number, name: string): void {
  if (!Number.isInteger(id) || id <= 0 || !name || seen.get(id) === name) return
  const db = getDb()
  db.transaction((tx) => {
    tx.update(mediaRequests).set({ requesterId: id }).where(and(isNull(mediaRequests.requesterId), eq(mediaRequests.requester, name))).run()
    tx.update(mediaRequests).set({ requester: name }).where(and(eq(mediaRequests.requesterId, id), ne(mediaRequests.requester, name))).run()
  })
  if (seen.size >= MAX_SEEN) seen.clear()
  seen.set(id, name)
}

/** Pour les tests : oublie les comptes déjà vus. */
export function forgetRequesters(): void {
  seen.clear()
}
