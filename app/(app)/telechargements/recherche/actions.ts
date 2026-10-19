'use server'

import { requireAdmin } from '@/lib/auth/viewer'
import { searchReleases, sendRelease, type ReleaseWire } from '@/lib/downloads/prowlarr-search'
import { errorMessage } from '@/lib/http'

export type SearchResult = { ok: true; releases: ReleaseWire[]; more: boolean } | { ok: false; message: string }

const ids = (value: unknown, max: number) =>
  Array.isArray(value) ? value.filter((id): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0).slice(0, max) : []

export async function searchReleasesAction(input: { query: string; categories: number[]; indexerIds: number[]; offset: number }): Promise<SearchResult> {
  await requireAdmin()
  const query = typeof input?.query === 'string' ? input.query.trim().slice(0, 200) : ''
  const offset = Number.isInteger(input?.offset) && input.offset >= 0 ? Math.min(input.offset, 10_000) : 0
  try {
    return { ok: true, ...(await searchReleases({ query, categories: ids(input?.categories, 20), indexerIds: ids(input?.indexerIds, 200), offset })) }
  } catch (error) {
    return { ok: false, message: errorMessage(error) }
  }
}

/** Envoie les releases choisies ; renvoie un message par release en échec. */
export async function sendReleasesAction(guids: string[]): Promise<{ sent: number; failures: string[] }> {
  await requireAdmin()
  const list = Array.isArray(guids) ? guids.filter((guid): guid is string => typeof guid === 'string' && guid.length > 0 && guid.length < 2_000).slice(0, 50) : []
  let sent = 0
  const failures: string[] = []
  // Une à une : qBit et les indexeurs n'aiment pas les rafales.
  for (const guid of list) {
    try {
      await sendRelease(guid)
      sent++
    } catch (error) {
      failures.push(errorMessage(error))
    }
  }
  return { sent, failures: [...new Set(failures)] }
}
