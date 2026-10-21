import { NextResponse } from 'next/server'
import { resolveCaller } from '@/lib/auth/caller'
import { parseFeedCursor, requestFeedPayload } from '@/lib/requests/contract'
import { requestFeed } from '@/lib/requests/feed'

/**
 * `GET /api/request/feed?after=<curseur>` : les demandes faites depuis le
 * dernier passage, pour la notification « Nouvelle demande » de l'app Onyx
 * (ADR-0013). Toutes les demandes, de tous les comptes : seul le serveur Onyx
 * y a accès, et il ne relaie qu'à un compte qui a `manage_settings`.
 */
export async function GET(request: Request) {
  const caller = await resolveCaller(request)
  if (caller.kind === 'refused') return NextResponse.json({ error: caller.message }, { status: caller.status })
  if (caller.kind !== 'onyx') return NextResponse.json({ error: 'Clé d\'intégration attendue.' }, { status: 401 })

  const cursor = parseFeedCursor(new URL(request.url).searchParams.get('after'))
  if (!cursor.ok) return NextResponse.json({ error: cursor.message }, { status: 400 })

  const feed = requestFeed(cursor.after, { name: caller.username, id: caller.userId })
  return NextResponse.json(requestFeedPayload(feed))
}
