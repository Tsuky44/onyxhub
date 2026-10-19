import { beforeEach, describe, expect, it } from 'vitest'
import { mockFetch } from '@/tests/fetch-mock'
import { ServiceError } from '../../http'
import { clearTmdbCache, createTmdb, tmdbAuth } from './client'

const V3 = '0123456789abcdef0123456789abcdef'
const page = (results: object[], total_pages = 1) => ({ page: 1, results, total_pages, total_results: results.length })

beforeEach(() => clearTmdbCache())

describe('authentification TMDB', () => {
  it('passe une clé v3 en paramètre', () => {
    expect(tmdbAuth(V3)).toEqual({ params: { api_key: V3 }, headers: {} })
  })

  it('passe un jeton v4 en en-tête Authorization', () => {
    const jwt = `eyJ${'a'.repeat(120)}`
    expect(tmdbAuth(jwt)).toEqual({ params: {}, headers: { Authorization: `Bearer ${jwt}` } })
  })
})

describe('client TMDB', () => {
  it('charge une fiche complète en une seule requête, en français', async () => {
    const { calls } = mockFetch([{ match: /\/movie\/603\?/, body: { id: 603, title: 'Matrix', poster_path: '/m.jpg', backdrop_path: null } }])
    const details = await createTmdb(V3).details('movie', 603)
    expect(details.title).toBe('Matrix')
    expect(calls).toHaveLength(1)
    const url = new URL(calls[0]!.url)
    expect(url.searchParams.get('language')).toBe('fr-FR')
    expect(url.searchParams.get('append_to_response')).toContain('credits')
    expect(url.searchParams.get('append_to_response')).toContain('watch/providers')
  })

  it('ne rappelle pas TMDB pour une fiche déjà en cache', async () => {
    const { calls } = mockFetch([{ match: /\/tv\/1399\?/, body: { id: 1399, name: 'GoT', poster_path: null, backdrop_path: null } }])
    const tmdb = createTmdb(V3)
    await tmdb.details('tv', 1399)
    await tmdb.details('tv', 1399)
    expect(calls).toHaveLength(1)
  })

  it('traduit le tri par date pour les séries', async () => {
    const { calls } = mockFetch([{ match: /\/discover\/tv/, body: page([]) }])
    await createTmdb(V3).discover('tv', { sortBy: 'primary_release_date.desc', from: '2024-01-01' })
    const url = new URL(calls[0]!.url)
    expect(url.searchParams.get('sort_by')).toBe('first_air_date.desc')
    expect(url.searchParams.get('first_air_date.gte')).toBe('2024-01-01')
  })

  it('marque chaque résultat de découverte avec son type', async () => {
    mockFetch([{ match: /\/discover\/movie/, body: page([{ id: 1, title: 'A', poster_path: null, backdrop_path: null }]) }])
    const result = await createTmdb(V3).discover('movie')
    expect(result.results[0]?.media_type).toBe('movie')
  })

  it("ne demande pas de films pour un genre propre aux séries dans l'onglet Tout", async () => {
    const { calls } = mockFetch([{ match: /\/discover\/tv/, body: page([{ id: 2, name: 'Talk', poster_path: null, backdrop_path: null }]) }])
    const result = await createTmdb(V3).discoverMixed({ genres: [10767] })
    expect(calls.every((call) => call.url.includes('/discover/tv'))).toBe(true)
    expect(result.results).toHaveLength(1)
  })

  it('mêle films et séries triés ensemble par popularité', async () => {
    mockFetch([
      { match: /\/discover\/movie/, body: page([{ id: 1, title: 'Film', popularity: 10, poster_path: null, backdrop_path: null }], 3) },
      { match: /\/discover\/tv/, body: page([{ id: 2, name: 'Série', popularity: 50, poster_path: null, backdrop_path: null }], 5) },
    ])
    const result = await createTmdb(V3).discoverMixed()
    expect(result.results.map((item) => item.id)).toEqual([2, 1])
    expect(result.total_pages).toBe(5)
  })

  it('retire les personnes de la recherche mixte', async () => {
    mockFetch([
      {
        match: /\/search\/multi/,
        body: page([
          { id: 1, media_type: 'movie', title: 'Dune', poster_path: null, backdrop_path: null },
          { id: 2, media_type: 'person', name: 'Denis', poster_path: null, backdrop_path: null },
        ]),
      },
    ])
    const result = await createTmdb(V3).search('multi', 'dune')
    expect(result.results.map((item) => item.id)).toEqual([1])
  })

  it('dit « accès refusé » pour une clé refusée, sans la répéter', async () => {
    mockFetch([{ match: /configuration/, status: 401, body: { status_message: 'Invalid API key' } }])
    const error = await createTmdb(V3).check().catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(ServiceError)
    expect((error as Error).message).toMatch(/accès refusé/)
    expect((error as Error).message).not.toContain(V3)
  })
})
