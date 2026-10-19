import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { resolveCaller } from '@/lib/auth/caller'
import { parseRequestBody } from '@/lib/requests/contract'
import { createRequest } from '@/lib/requests/create'

/**
 * `POST /api/request` : la demande envoyée par le serveur Onyx (ADR-0002),
 * au format de MediaHub. Réponse `{ success, message }`, ou `{ error }` avec
 * le statut HTTP de l'échec, que le serveur Onyx relaie tel quel à l'app.
 */
export async function POST(request: Request) {
  const caller = await resolveCaller(request)
  if (caller.kind === 'refused') return NextResponse.json({ error: caller.message }, { status: caller.status })
  if (caller.kind === 'viewer' && !caller.canRequest) {
    return NextResponse.json({ error: 'Ton compte Onyx n\'a pas le droit de demander des médias.' }, { status: 403 })
  }

  const parsed = parseRequestBody(await request.json().catch(() => null))
  if (!parsed.ok) return NextResponse.json({ error: parsed.message }, { status: 400 })

  const outcome = await createRequest(parsed.input, caller.username)
  if (!outcome.ok) return NextResponse.json({ error: outcome.message }, { status: outcome.status })

  revalidatePath('/demandes', 'layout')
  return NextResponse.json({ success: true, message: outcome.message })
}
