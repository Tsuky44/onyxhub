import { NextResponse } from 'next/server'
import { resolveCaller } from '@/lib/auth/caller'
import { integrationPingPayload } from '@/lib/requests/contract'
import { version } from '@/package.json'

/**
 * `GET /api/integration/ping` : le bouton « Tester » d'Onyx (ADR-0009).
 * Répond seulement à la clé d'intégration : un 200 prouve à la fois que
 * l'adresse est celle d'OnyxHub et que la clé est la bonne.
 */
export async function GET(request: Request) {
  const caller = await resolveCaller(request)
  if (caller.kind === 'refused') return NextResponse.json({ error: caller.message }, { status: caller.status })
  if (caller.kind !== 'onyx') return NextResponse.json({ error: 'Clé d\'intégration attendue.' }, { status: 401 })
  return NextResponse.json(integrationPingPayload(version))
}
