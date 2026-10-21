import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { mockFetch } from '@/tests/fetch-mock'
import { pingOnyx } from '../services/onyx/auth'
import { OnyxCapability } from '../services/onyx/capabilities'
import { announceImport } from '../services/onyx/imports'
import { fetchOnyxLibrary } from '../services/onyx/library'
import { createOnyxWatchLater } from '../services/onyx/lists'
import { createOnyxSettings } from '../services/onyx/settings'
import type { Availability } from './availability'
import {
  availabilityBatchPayload,
  availabilityPayload,
  integrationPingPayload,
  myRequestsPayload,
  parseAvailabilityBatch,
  parseRequestBody,
  requestFeedPayload,
  type MyRequest,
} from './contract'
import type { RequestFeed } from './feed'
import { onyxMediaId } from './onyx-presence'

/**
 * Le contrat avec Onyx, vu d'OnyxHub (ADR-0012).
 *
 * `tests/contract/onyx/` copie `contract/onyxhub/` du dépôt d'Onyx (plus les
 * réponses d'Onyx qu'OnyxHub lit aussi). Le serveur Go relit les mêmes
 * fichiers : ce qu'OnyxHub écrit doit valoir le fichier, et ce qu'Onyx écrit
 * doit se lire ici. Quand le dépôt d'Onyx est à côté (`../project playeur`,
 * ou `ONYX_REPO`), la copie doit lui être identique.
 */
const COPY = join(process.cwd(), 'tests', 'contract', 'onyx')
const ONYX_REPO = process.env.ONYX_REPO ?? join(process.cwd(), '..', 'project playeur')

const fixture = (name: string): unknown => JSON.parse(readFileSync(join(COPY, name), 'utf8'))

const UPSTREAM: Record<string, string> = {
  'ping.json': 'contract/ping.json',
  'watch_list.json': 'contract/watch_list.json',
  'watch_lists.json': 'contract/watch_lists.json',
  ...Object.fromEntries(
    [
      'request.json',
      'availability.json',
      'availability_batch_request.json',
      'availability_batch.json',
      'integration_ping.json',
      'my_requests.json',
      'imported.json',
      'library_tmdb_index.json',
      'mediahub_link_test.json',
      'request_feed.json',
    ].map((name) => [name, `contract/onyxhub/${name}`]),
  ),
}

describe.skipIf(!existsSync(join(ONYX_REPO, 'contract', 'onyxhub')))('copie du contrat d’Onyx', () => {
  it.each(Object.entries(UPSTREAM))('%s est identique à celui du dépôt d’Onyx', (name, upstream) => {
    const normalize = (text: string) => text.replace(/\r\n/g, '\n')
    expect(
      normalize(readFileSync(join(COPY, name), 'utf8')),
      `Recopier ${upstream} du dépôt d'Onyx dans tests/contract/onyx/${name}, puis faire passer ce test.`,
    ).toBe(normalize(readFileSync(join(ONYX_REPO, upstream), 'utf8')))
  })
})

describe('contrat avec Onyx', () => {
  it('lit la demande et le lot de disponibilités que l’app et le serveur Onyx envoient', () => {
    expect(parseRequestBody(fixture('request.json'))).toMatchObject({ ok: true, input: { tmdbId: 1399, mediaType: 'tv', seasons: [1, 2] } })
    expect(parseAvailabilityBatch(fixture('availability_batch_request.json'))).toEqual({
      ok: true,
      items: [
        { tmdbId: 603, mediaType: 'movie' },
        { tmdbId: 1399, mediaType: 'tv' },
      ],
    })
  })

  it('répond les disponibilités au format que lit le serveur Onyx', () => {
    const single = fixture('availability.json') as Availability
    const withCounts = (availability: Availability): Availability => ({
      ...availability,
      seasons: availability.seasons.map((season) => ({ ...season, episodeFileCount: 0 })),
    })
    expect(availabilityPayload(withCounts(single))).toEqual(single)

    const batch = fixture('availability_batch.json') as { results: (Availability & { tmdbId: number; mediaType: 'movie' | 'tv' })[] }
    const answered = batch.results.map(({ tmdbId, mediaType, ...availability }) => ({ query: { tmdbId, mediaType }, availability: withCounts(availability) }))
    expect(availabilityBatchPayload(answered)).toEqual(batch)
  })

  it('se présente au test de liaison comme Onyx l’attend', () => {
    const ping = fixture('integration_ping.json') as { version: string }
    expect(integrationPingPayload(ping.version)).toEqual(ping)
  })

  it('rend « Mes demandes » au format que lit l’app Onyx', () => {
    const payload = fixture('my_requests.json') as { requests: MyRequest[] }
    expect(myRequestsPayload(payload.requests)).toEqual(payload)
  })

  it('rend le flux des nouvelles demandes au format que lit l’app Onyx', () => {
    const payload = fixture('request_feed.json') as RequestFeed
    expect(requestFeedPayload(payload)).toEqual(payload)
  })

  it('annonce un import au format que lit le serveur Onyx', async () => {
    const { calls } = mockFetch([{ method: 'POST', match: /imported$/, status: 202, body: { status: 'queued' } }])
    const imported = fixture('imported.json') as { tmdbId: number; mediaType: 'tv'; paths: string[] }
    await announceImport('http://onyx:8080', 'cle', imported)
    expect(JSON.parse(calls[0]!.body!)).toEqual(imported)
  })

  it('lit l’index de la bibliothèque et le résultat du test de liaison d’Onyx', async () => {
    mockFetch([
      { match: /tmdb-index$/, body: fixture('library_tmdb_index.json') },
      { method: 'POST', match: /mediahub\/test$/, body: fixture('mediahub_link_test.json') },
    ])
    const index = await fetchOnyxLibrary('http://onyx:8080', 't')
    expect(onyxMediaId(index, 'movie', 603)).toBe(12)
    expect(onyxMediaId(index, 'tv', 1399)).toBe(40)
    expect(await createOnyxSettings('http://onyx:8080', 't').testHub()).toMatchObject({ ok: true })
  })

  it('n’attend d’Onyx que des capacités que l’Onyx actuel annonce', async () => {
    mockFetch([{ match: /\/api\/ping$/, body: fixture('ping.json') }])
    const { capabilities } = await pingOnyx('http://onyx:8080')
    for (const capability of Object.values(OnyxCapability)) expect(capabilities, capability).toContain(capability)
  })

  it('lit la liste « Plus tard » telle qu’Onyx la rend', async () => {
    mockFetch([
      { match: /\/api\/lists$/, body: fixture('watch_lists.json') },
      { match: /\/api\/lists\/1$/, body: fixture('watch_list.json') },
    ])
    const items = await createOnyxWatchLater('http://onyx:8080', 't').items()
    expect(items).toEqual([{ id: 5, mediaType: 'tv', tmdbId: 6, title: 'title-value', posterPath: null }])
  })
})
