import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { mockFetch, type MockRoute } from '@/tests/fetch-mock'
import { createTempDataDir } from '@/tests/temp-db'

createTempDataDir()

const { getDb } = await import('../db')
const { mediaRequests } = await import('../db/schema')
const { setSettings } = await import('../settings/store')
const { clearTmdbCache } = await import('../services/tmdb/client')
const { createRequest } = await import('./create')
const { removeMedia, removeRequests, removeSeason } = await import('./remove')
const { requestsForMedia } = await import('./repository')

beforeAll(() => {
  setSettings({ tmdb_api_key: 'cle-tmdb', sorraa_url: 'http://sorraa:7878' })
})

beforeEach(() => {
  getDb().delete(mediaRequests).run()
  clearTmdbCache()
})

const show: MockRoute = {
  match: /themoviedb\.org\/3\/tv\/1396\?/,
  body: { id: 1396, name: 'Breaking Bad', poster_path: '/bb.jpg', external_ids: { tvdb_id: 81189 } },
}

const sorraaRequest = (id: number, seasons: number[], state = 'pending') => ({
  id,
  mediaId: 7,
  kind: 'series',
  tmdbId: 1396,
  state,
  seasons: seasons.map((number) => ({ number, state })),
})

describe('demandes envoyées à sorraa', () => {
  it('envoie seulement les saisons voulues et garde une ligne par saison', async () => {
    const { calls } = mockFetch([show, { method: 'POST', match: /sorraa:7878\/api\/v1\/requests$/, status: 201, body: sorraaRequest(1, [2]) }])

    const outcome = await createRequest({ mediaType: 'tv', tmdbId: 1396, seasons: [2] }, 'Ana', 42)

    expect(outcome).toMatchObject({ ok: true, created: 1 })
    const sent = JSON.parse(calls.find((call) => call.url.endsWith('/requests'))!.body!)
    expect(sent).toEqual({ kind: 'series', tmdbId: 1396, seasons: [2], requester: { name: 'Ana', ref: '42' } })
    expect(requestsForMedia('tv', 1396).map((row) => [row.seasonNumber, row.status, row.tvdbId])).toEqual([[2, 'approved', 81189]])
  })

  it('demande toute la série sans liste de saisons, et suit les saisons que sorraa renvoie', async () => {
    const { calls } = mockFetch([show, { method: 'POST', match: /sorraa:7878\/api\/v1\/requests$/, status: 201, body: sorraaRequest(1, [1, 2]) }])

    await createRequest({ mediaType: 'tv', tmdbId: 1396 }, 'Ana')

    expect(JSON.parse(calls.find((call) => call.url.endsWith('/requests'))!.body!)).not.toHaveProperty('seasons')
    expect(requestsForMedia('tv', 1396).map((row) => row.seasonNumber)).toEqual([1, 2])
  })

  it('demande un film', async () => {
    mockFetch([
      { match: /themoviedb\.org\/3\/movie\/603\?/, body: { id: 603, title: 'Matrix' } },
      { method: 'POST', match: /sorraa:7878\/api\/v1\/requests$/, status: 201, body: { id: 3, mediaId: 9, kind: 'movie', tmdbId: 603, state: 'processing' } },
    ])

    await createRequest({ mediaType: 'movie', tmdbId: 603 }, 'Ana')

    expect(requestsForMedia('movie', 603).map((row) => [row.seasonNumber, row.status])).toEqual([[null, 'processing']])
  })
})

describe('retrait par l API de sorraa', () => {
  async function ask() {
    mockFetch([show, { method: 'POST', match: /sorraa:7878\/api\/v1\/requests$/, status: 201, body: sorraaRequest(1, [1, 2]) }])
    await createRequest({ mediaType: 'tv', tmdbId: 1396, seasons: [1, 2] }, 'Ana')
  }

  it('retire une saison de la recherche sans toucher à l autre', async () => {
    await ask()
    const season2 = requestsForMedia('tv', 1396).find((row) => row.seasonNumber === 2)!
    const { calls } = mockFetch([
      { match: /sorraa:7878\/api\/v1\/requests\?/, body: { items: [sorraaRequest(1, [1, 2])] } },
      { method: 'DELETE', match: /sorraa:7878\/api\/v1\/requests\/1\?/ },
    ])

    const report = await removeRequests([season2.id])

    expect(report).toEqual({ deleted: 1, warnings: [] })
    const withdrawal = calls.find((call) => call.method === 'DELETE')!
    expect(new URL(withdrawal.url).searchParams.get('seasons')).toBe('2')
    expect(new URL(withdrawal.url).searchParams.get('stopSearching')).toBe('true')
    expect(requestsForMedia('tv', 1396).map((row) => row.seasonNumber)).toEqual([1])
  })

  it('retire une série complète de la recherche en une demande', async () => {
    await ask()
    const ids = requestsForMedia('tv', 1396).map((row) => row.id)
    const { calls } = mockFetch([
      { match: /sorraa:7878\/api\/v1\/requests\?/, body: { items: [sorraaRequest(1, [1, 2])] } },
      { method: 'DELETE', match: /sorraa:7878\/api\/v1\/requests\/1\?/ },
    ])

    await removeRequests(ids)

    expect(new URL(calls.find((call) => call.method === 'DELETE')!.url).searchParams.get('seasons')).toBe('1,2')
    expect(requestsForMedia('tv', 1396)).toHaveLength(0)
  })

  it('retire complètement une saison et ses fichiers', async () => {
    await ask()
    const { calls } = mockFetch([
      { match: /sorraa:7878\/api\/v1\/requests\?/, body: { items: [sorraaRequest(1, [1, 2])] } },
      { method: 'DELETE', match: /sorraa:7878\/api\/v1\/media\/7\/seasons\/2\?/, body: {} },
    ])

    await removeSeason(1396, 2, true)

    const url = new URL(calls.find((call) => call.method === 'DELETE')!.url)
    expect(url.pathname).toBe('/api/v1/media/7/seasons/2')
    expect(url.searchParams.get('deleteFiles')).toBe('true')
    expect(requestsForMedia('tv', 1396).map((row) => row.seasonNumber)).toEqual([1])
  })

  it('retire complètement une série, fichiers conservés', async () => {
    await ask()
    const { calls } = mockFetch([
      { match: /sorraa:7878\/api\/v1\/requests\?/, body: { items: [sorraaRequest(1, [1, 2])] } },
      { method: 'DELETE', match: /sorraa:7878\/api\/v1\/media\/7$/ },
    ])

    await removeMedia('tv', 1396, false)

    expect(calls.find((call) => call.method === 'DELETE')!.url).toBe('http://sorraa:7878/api/v1/media/7')
    expect(requestsForMedia('tv', 1396)).toHaveLength(0)
  })

  it('retrouve le média d un titre sans demande en parcourant la bibliothèque', async () => {
    mockFetch([
      { match: /sorraa:7878\/api\/v1\/requests\?/, body: { items: [] } },
      { match: /sorraa:7878\/api\/v1\/media\?/, body: { items: [{ id: 4, tmdbId: 1396 }] } },
      { method: 'DELETE', match: /sorraa:7878\/api\/v1\/media\/4$/ },
    ])

    await expect(removeMedia('tv', 1396, false)).resolves.toBeUndefined()
  })

  it('présente une erreur de sorraa sans son adresse', async () => {
    await ask()
    mockFetch([
      { match: /sorraa:7878\/api\/v1\/requests\?/, status: 503, body: { title: 'x', detail: 'Metadata source unavailable' } },
    ])
    const report = await removeRequests(requestsForMedia('tv', 1396).map((row) => row.id))
    expect(report.warnings[0]).toContain('Metadata source unavailable')
    expect(report.warnings[0]).not.toContain('sorraa:7878')
  })
})
