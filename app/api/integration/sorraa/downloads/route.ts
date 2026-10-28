import { NextResponse } from 'next/server'
import { resolveSorraaCaller } from '@/lib/auth/caller'
import { parseSorraaDownloads } from '@/lib/integration/sorraa'
import { recordSorraaDownloads } from '@/lib/integration/sorraa-downloads'

/**
 * `POST /api/integration/sorraa/downloads` : sorraa dit où en sont les
 * téléchargements en cours. Le rapport est entier et remplace le précédent ;
 * il est gardé en mémoire. sorraa relève son client toutes les 10 s et
 * n'envoie que ce qui a changé, ou chaque minute pour dire qu'il est là.
 */
export async function POST(request: Request) {
  const caller = resolveSorraaCaller(request)
  if (!caller.ok) return NextResponse.json({ error: caller.message }, { status: caller.status })

  const downloads = parseSorraaDownloads(await request.json().catch(() => null))
  recordSorraaDownloads(downloads)
  return NextResponse.json({ accepted: downloads.length })
}
