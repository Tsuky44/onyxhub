import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { resolveCaller } from '@/lib/auth/caller'
import { errorMessage } from '@/lib/http'
import { parseSorraaEvents } from '@/lib/integration/sorraa'
import { applySorraaEvents } from '@/lib/integration/sorraa-events'

/**
 * `POST /api/integration/sorraa/events` : sorraa dit ce qui est arrivé à la
 * bibliothèque (recherche, saisie, import, échec), dans l'ordre. Réservé à la
 * clé d'intégration. Un lot vide prouve la liaison (le « Tester » de sorraa).
 * Un lot est rejoué tel quel tant qu'on n'a pas répondu 2xx : appliquer deux
 * fois le même événement ne change rien.
 */
export async function POST(request: Request) {
  const caller = await resolveCaller(request)
  if (caller.kind === 'refused') return NextResponse.json({ error: caller.message }, { status: caller.status })
  if (caller.kind !== 'onyx') return NextResponse.json({ error: "Clé d'intégration attendue." }, { status: 401 })

  const events = parseSorraaEvents(await request.json().catch(() => null))
  try {
    if ((await applySorraaEvents(events)) > 0) revalidatePath('/demandes', 'layout')
  } catch (error) {
    // sorraa réessaie le lot au prochain passage.
    console.error(`[sorraa] événements : ${errorMessage(error)}`)
    return NextResponse.json({ error: 'Traitement impossible pour le moment.' }, { status: 503 })
  }
  return NextResponse.json({ accepted: events.length })
}
