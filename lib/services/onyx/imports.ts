import 'server-only'
import { request } from '../../http'
import type { MediaType } from '../tmdb/types'

/**
 * `POST /api/integrations/onyxhub/imported` (ADR-0074 d'Onyx) : un import
 * vient d'avoir lieu, Onyx vide le statut en cache du titre et indexe sans
 * attendre son prochain passage. OnyxHub présente la clé d'intégration, celle
 * qu'Onyx lui présente dans l'autre sens.
 */
export async function announceImport(
  baseUrl: string,
  integrationKey: string,
  imported: { tmdbId?: number; mediaType: MediaType; paths: readonly string[] },
): Promise<void> {
  await request('Onyx', `${baseUrl}/api/integrations/onyxhub/imported`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${integrationKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ tmdbId: imported.tmdbId ?? 0, mediaType: imported.mediaType, paths: imported.paths }),
    timeoutMs: 5_000,
  })
}
