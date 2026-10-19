import { beforeEach, describe, expect, it } from 'vitest'
import { mockFetch } from '@/tests/fetch-mock'
import { clearArrCache } from './arr/client'
import { createProwlarr, searchType, sortReleases, type ProwlarrRelease } from './prowlarr'

const config = { baseUrl: 'http://prowlarr:9696', apiKey: 'cle-prowlarr' }
const release = (guid: string, seeders: number, publishDate: string): ProwlarrRelease => ({
  guid,
  indexerId: 1,
  indexer: 'X',
  title: guid,
  size: 1,
  seeders,
  publishDate,
  protocol: 'torrent',
})

beforeEach(() => clearArrCache())

describe('Prowlarr', () => {
  it('répète les clés indexerIds et categories au lieu de les joindre par des virgules', async () => {
    const { calls } = mockFetch([{ match: /\/api\/v1\/search\?/, body: [] }])
    await createProwlarr(config).search({ query: 'dune', indexerIds: [1, 2], categories: [2000, 2040] })
    const url = new URL(calls[0]!.url)
    expect(url.searchParams.getAll('indexerIds')).toEqual(['1', '2'])
    expect(url.searchParams.getAll('categories')).toEqual(['2000', '2040'])
    expect(url.searchParams.get('type')).toBe('movie')
  })

  it("n'envoie pas de requête vide (mode « derniers ajouts »)", async () => {
    const { calls } = mockFetch([{ match: /\/api\/v1\/search/, body: [] }])
    await createProwlarr(config).search({ query: '  ' })
    expect(new URL(calls[0]!.url).searchParams.has('query')).toBe(false)
  })

  it('classe les plus partagées en premier, puis les plus récentes', () => {
    const sorted = sortReleases([release('a', 5, '2024-01-01'), release('b', 50, '2020-01-01'), release('c', 5, '2025-01-01')])
    expect(sorted.map((item) => item.guid)).toEqual(['b', 'c', 'a'])
  })

  it('choisit le type de recherche selon les catégories', () => {
    expect(searchType([5030])).toBe('tvsearch')
    expect(searchType([])).toBe('search')
  })
})
