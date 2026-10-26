import { NextResponse } from 'next/server'
import { resolveCaller } from '@/lib/auth/caller'
import { errorMessage } from '@/lib/http'
import { availabilityPayload } from '@/lib/requests/contract'
import { mediaAvailability } from '@/lib/requests/media-availability'
import { waitingFor } from '@/lib/requests/sorraa-waiting'
import { waitingText } from '@/lib/requests/waiting'

/**
 * `GET /api/media/availability/:id?type=movie|tv` : la disponibilité d'un
 * média pour le serveur Onyx (ADR-0002). MediaHub la servait sans aucune
 * authentification ; ici, clé d'intégration ou session.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await resolveCaller(request)
  if (caller.kind === 'refused') return NextResponse.json({ error: caller.message }, { status: caller.status })

  const tmdbId = Number((await params).id)
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) return NextResponse.json({ error: 'Identifiant TMDB invalide.' }, { status: 400 })
  const type = new URL(request.url).searchParams.get('type') === 'tv' ? 'tv' : 'movie'

  try {
    const availability = await mediaAvailability(type, tmdbId)
    // Pourquoi la demande attend (ajout facultatif : Onyx l'ignore s'il ne le connaît pas).
    const waiting = availability.status === 'available' ? null : await waitingFor(type, tmdbId)
    return NextResponse.json({
      ...availabilityPayload(availability),
      ...(waiting ? { waiting: { reason: waiting.reason, attempts: waiting.attempts, nextAttemptAt: waiting.nextAttemptAt, message: waitingText(waiting) } } : {}),
    })
  } catch (error) {
    console.error(`[disponibilité] ${type}/${tmdbId} : ${errorMessage(error)}`)
    // Même forme qu'un succès : le serveur Onyx lit `status` et retombe sur « unknown ».
    return NextResponse.json({ status: 'unknown', available: false, seasons: [] }, { status: 500 })
  }
}
