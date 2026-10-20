import { NextResponse } from 'next/server'
import { resolveCaller } from '@/lib/auth/caller'
import { errorMessage } from '@/lib/http'
import { availabilityBatchPayload, parseAvailabilityBatch } from '@/lib/requests/contract'
import { availabilityBatch } from '@/lib/requests/media-availability'
import { UNKNOWN_AVAILABILITY } from '@/lib/requests/availability'

/**
 * `POST /api/media/availability` : les disponibilités d'une page du catalogue
 * d'Onyx en un seul appel (ADR-0009). Onyx en faisait un par carte, vingt
 * par page, sur la route unitaire qui reste servie pour les anciens Onyx.
 */
export async function POST(request: Request) {
  const caller = await resolveCaller(request)
  if (caller.kind === 'refused') return NextResponse.json({ error: caller.message }, { status: caller.status })

  const parsed = parseAvailabilityBatch(await request.json().catch(() => null))
  if (!parsed.ok) return NextResponse.json({ error: parsed.message }, { status: 400 })

  try {
    const availabilities = await availabilityBatch(parsed.items)
    return NextResponse.json(
      availabilityBatchPayload(parsed.items.map((query, position) => ({ query, availability: availabilities[position] ?? UNKNOWN_AVAILABILITY }))),
    )
  } catch (error) {
    console.error(`[disponibilité] lot de ${parsed.items.length} : ${errorMessage(error)}`)
    // Même forme qu'un succès, tout en « unknown » : Onyx affiche alors les cartes sans pastille.
    return NextResponse.json(availabilityBatchPayload(parsed.items.map((query) => ({ query, availability: UNKNOWN_AVAILABILITY }))), { status: 500 })
  }
}
