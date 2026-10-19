import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { mockFetch, type MockRoute } from '@/tests/fetch-mock'
import { createTempDataDir } from '@/tests/temp-db'

createTempDataDir()

const { getDb } = await import('../db')
const { mediaRequests } = await import('../db/schema')
const { setSettings } = await import('../settings/store')
const { clearArrCache } = await import('../services/arr/client')
const { clearTmdbCache } = await import('../services/tmdb/client')
const { createRequest } = await import('./create')
const { removeRequests } = await import('./remove')
const { listRequestBatches, requestsForMedia } = await import('./repository')
const { onArrEvent } = await import('./sync')

beforeAll(() => {
  setSettings({
    tmdb_api_key: 'cle-tmdb',
    radarr_url: 'http://radarr:7878',
    radarr_api_key: 'cle-radarr',
    sonarr_url: 'http://sonarr:8989',
    sonarr_api_key: 'cle-sonarr',
  })
})

beforeEach(() => {
  getDb().delete(mediaRequests).run()
  clearArrCache()
  clearTmdbCache()
})

const matrix: MockRoute[] = [
  { match: /themoviedb\.org\/3\/movie\/603\?/, body: { id: 603, title: 'Matrix', poster_path: '/matrix.jpg' } },
  { match: /radarr:7878\/api\/v3\/movie\?tmdbId=603/, body: [] },
  { match: /\/movie\/lookup\/tmdb/, body: { tmdbId: 603, title: 'Matrix', year: 1999 } },
  { match: /radarr:7878\/api\/v3\/qualityprofile$/, body: [{ id: 1, name: 'HD' }] },
  { match: /radarr:7878\/api\/v3\/rootfolder$/, body: [{ id: 1, path: '/films' }] },
  { method: 'POST', match: /radarr:7878\/api\/v3\/movie$/, body: { id: 5, tmdbId: 603, title: 'Matrix', monitored: true, hasFile: false } },
  { method: 'POST', match: /\/command$/, body: { id: 1 } },
]

const stats = (files: number, total: number) => ({ episodeFileCount: files, episodeCount: total, totalEpisodeCount: total })
const got = {
  id: 40,
  tvdbId: 121361,
  title: 'Game of Thrones',
  monitored: true,
  seasons: [
    { seasonNumber: 1, monitored: true, statistics: stats(10, 10) },
    { seasonNumber: 2, monitored: false, statistics: stats(0, 10) },
  ],
}
const gotRoutes: MockRoute[] = [
  { match: /themoviedb\.org\/3\/tv\/1399\?/, body: { id: 1399, name: 'Game of Thrones', poster_path: '/got.jpg', external_ids: { tvdb_id: 121361 } } },
  { match: /sonarr:8989\/api\/v3\/series\?tvdbId=121361/, body: [got] },
  { method: 'PUT', match: /sonarr:8989\/api\/v3\/series\/40$/, body: { ...got, seasons: got.seasons.map((season) => ({ ...season, monitored: true })) } },
  { method: 'POST', match: /\/command$/, body: { id: 1 } },
]

describe('envoyer une demande', () => {
  it('ajoute le film à Radarr et crée une demande approuvée', async () => {
    mockFetch(matrix)
    const outcome = await createRequest({ mediaType: 'movie', tmdbId: 603 }, 'alice')
    expect(outcome).toEqual({ ok: true, message: '« Matrix » est demandé : Radarr le cherche.', created: 1 })
    expect(requestsForMedia('movie', 603)).toMatchObject([{ status: 'approved', requester: 'alice', posterPath: '/matrix.jpg', seasonNumber: null }])
  })

  it('crée une ligne par saison, déjà disponible pour une saison complète', async () => {
    mockFetch(gotRoutes)
    const outcome = await createRequest({ mediaType: 'tv', tmdbId: 1399, seasons: [1, 2] }, 'alice')
    expect(outcome).toMatchObject({ ok: true, created: 2 })
    const rows = requestsForMedia('tv', 1399)
    expect(rows.map((row) => [row.seasonNumber, row.status])).toEqual([
      [1, 'available'],
      [2, 'approved'],
    ])
    expect(new Set(rows.map((row) => row.batchId)).size).toBe(1)
    expect(rows[0]!.tvdbId).toBe(121361)
  })

  it('ne réenvoie pas une saison déjà demandée, même par quelqu\'un d\'autre', async () => {
    mockFetch(gotRoutes)
    await createRequest({ mediaType: 'tv', tmdbId: 1399, seasons: [2] }, 'alice')
    const second = await createRequest({ mediaType: 'tv', tmdbId: 1399, seasons: [2] }, 'bob')
    expect(second).toMatchObject({ ok: true, created: 0, message: 'Cette saison de « Game of Thrones » est déjà demandée.' })
    expect(requestsForMedia('tv', 1399)).toHaveLength(1)
  })

  it('dit quand Radarr n\'est pas configuré au lieu de planter', async () => {
    setSettings({ radarr_url: '' })
    mockFetch(matrix)
    const outcome = await createRequest({ mediaType: 'movie', tmdbId: 603 }, 'alice')
    expect(outcome).toMatchObject({ ok: false, status: 503 })
    setSettings({ radarr_url: 'http://radarr:7878' })
  })
})

describe('supprimer une demande', () => {
  it('cesse de surveiller seulement la saison que plus personne ne demande', async () => {
    mockFetch(gotRoutes)
    await createRequest({ mediaType: 'tv', tmdbId: 1399, seasons: [1, 2] }, 'alice')
    const season2 = requestsForMedia('tv', 1399).find((row) => row.seasonNumber === 2)!

    const { calls } = mockFetch([
      { match: /sonarr:8989\/api\/v3\/series\?tvdbId=121361/, body: [got] },
      { match: /sonarr:8989\/api\/v3\/series\/40$/, body: { ...got, seasons: got.seasons.map((season) => ({ ...season, monitored: true })) } },
      { method: 'PUT', match: /sonarr:8989\/api\/v3\/series\/40$/, body: got },
    ])
    const report = await removeRequests([season2.id])
    expect(report).toEqual({ deleted: 1, warnings: [] })
    const put = JSON.parse(calls.find((call) => call.method === 'PUT')!.body!)
    expect(put.seasons.map((season: { monitored: boolean }) => season.monitored)).toEqual([true, false])
    expect(calls.some((call) => call.method === 'DELETE')).toBe(false)
    expect(requestsForMedia('tv', 1399).map((row) => row.seasonNumber)).toEqual([1])
  })

  it('retire de Radarr un film supprimé avant tout téléchargement', async () => {
    mockFetch(matrix)
    await createRequest({ mediaType: 'movie', tmdbId: 603 }, 'alice')
    const { calls } = mockFetch([
      { match: /radarr:7878\/api\/v3\/movie\?tmdbId=603/, body: [{ id: 5, tmdbId: 603, title: 'Matrix', monitored: true, hasFile: false }] },
      { method: 'DELETE', match: /radarr:7878\/api\/v3\/movie\/5/, body: {} },
    ])
    await removeRequests(requestsForMedia('movie', 603).map((row) => row.id))
    expect(new URL(calls.find((call) => call.method === 'DELETE')!.url).searchParams.get('deleteFiles')).toBe('false')
  })
})

describe('liste et webhooks', () => {
  it('regroupe les saisons demandées ensemble et filtre par demandeur', async () => {
    mockFetch([...matrix, ...gotRoutes])
    await createRequest({ mediaType: 'movie', tmdbId: 603 }, 'bob')
    await createRequest({ mediaType: 'tv', tmdbId: 1399, seasons: [1, 2] }, 'alice')
    const all = listRequestBatches({ viewer: 'alice' }, 0, 10)
    expect(all.batches.map((batch) => batch.length)).toEqual([2, 1])
    const mine = listRequestBatches({ viewer: 'alice', owner: 'mine' }, 0, 10)
    expect(mine.batches).toHaveLength(1)
    expect(listRequestBatches({ viewer: 'alice', query: 'matr' }, 0, 10).batches[0]![0]!.title).toBe('Matrix')
  })

  it('passe « en cours » les saisons saisies par Sonarr', async () => {
    mockFetch(gotRoutes)
    await createRequest({ mediaType: 'tv', tmdbId: 1399, seasons: [1, 2] }, 'alice')
    const changed = await onArrEvent({ mediaType: 'tv', eventType: 'Grab', tvdbId: 121361, seasons: [2] })
    expect(changed).toBe(1)
    expect(requestsForMedia('tv', 1399).map((row) => row.status)).toEqual(['available', 'processing'])
  })
})
