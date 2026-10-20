import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { webhookAuthorized } from '@/lib/auth/webhook'
import { errorMessage } from '@/lib/http'
import { notifyOnyxOfImport } from '@/lib/integration/onyx-import'
import { onArrEvent } from '@/lib/requests/sync'
import { parseRadarrEvent } from '@/lib/requests/webhook-payload'

/** Webhook Radarr : fait avancer les demandes du média concerné (saisie, import, suppression…). */
export async function POST(request: Request) {
  if (!webhookAuthorized(request)) return NextResponse.json({ error: 'Secret de webhook absent ou invalide.' }, { status: 401 })

  const event = parseRadarrEvent(await request.json().catch(() => null))
  if (!event) return NextResponse.json({ success: true })
  // Onyx est prévenu en parallèle : sa réponse ne retarde pas celle due à Radarr.
  void notifyOnyxOfImport(event)
  try {
    if ((await onArrEvent(event)) > 0) revalidatePath('/demandes', 'layout')
  } catch (error) {
    // Radarr réessaie un webhook en échec : on le dit, sans faire tomber la route.
    console.error(`[webhook radarr] ${event.eventType} : ${errorMessage(error)}`)
    return NextResponse.json({ error: 'Traitement impossible pour le moment.' }, { status: 503 })
  }
  return NextResponse.json({ success: true })
}
