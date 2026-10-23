import { NextResponse } from 'next/server'
import { resolveCaller } from '@/lib/auth/caller'
import { parseSorraaDownloads } from '@/lib/integration/sorraa'
import { recordSorraaDownloads } from '@/lib/integration/sorraa-downloads'

/**
 * `POST /api/integration/sorraa/downloads` : sorraa dit où en sont les
 * téléchargements en cours. Le rapport est entier et remplace le précédent ;
 * il est gardé en mémoire (il se renouvelle au moins chaque minute).
 */
export async function POST(request: Request) {
  const caller = await resolveCaller(request)
  if (caller.kind === 'refused') return NextResponse.json({ error: caller.message }, { status: caller.status })
  if (caller.kind !== 'onyx') return NextResponse.json({ error: "Clé d'intégration attendue." }, { status: 401 })

  const downloads = parseSorraaDownloads(await request.json().catch(() => null))
  recordSorraaDownloads(downloads)
  return NextResponse.json({ accepted: downloads.length })
}
