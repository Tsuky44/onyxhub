import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { resolveCaller } from '@/lib/auth/caller'
import { homeRequests } from '@/lib/home/requests'
import { errorMessage } from '@/lib/http'
import { myRequestsPayload, parseRequestBody } from '@/lib/requests/contract'
import { PAGE_SIZE } from '@/lib/requests/list'
import { createRequest } from '@/lib/requests/create'

/** Une page de la liste des demandes : au-delà, la liste complète est dans OnyxHub. */
const MY_REQUESTS_LIMIT = PAGE_SIZE

/**
 * `GET /api/request` : les demandes du compte que nomme `X-Player-Username`
 * (ou du compte connecté), avec la progression du téléchargement, pour
 * l'écran « Mes demandes » de l'app Onyx (ADR-0010).
 */
export async function GET(request: Request) {
  const caller = await resolveCaller(request)
  if (caller.kind === 'refused') return NextResponse.json({ error: caller.message }, { status: caller.status })
  try {
    const groups = await homeRequests({ viewer: caller.username, owner: 'mine' }, MY_REQUESTS_LIMIT)
    return NextResponse.json(myRequestsPayload(groups))
  } catch (error) {
    console.error(`[mes demandes] ${caller.username} : ${errorMessage(error)}`)
    return NextResponse.json({ error: 'Les demandes n\'ont pas pu être lues.' }, { status: 500 })
  }
}

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
