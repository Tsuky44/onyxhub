import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch } from '@/tests/fetch-mock'
import { createTempDataDir } from '@/tests/temp-db'

createTempDataDir()

const { getDb } = await import('../db')
const { calendarSubscriptions } = await import('../db/schema')
const { setSettings } = await import('../settings/store')
const { clearTmdbCache } = await import('../services/tmdb/client')
const { isSubscribed, listSubscriptions, setSubscription, subscriptionReleases } = await import('./subscriptions')

const dune = { mediaType: 'movie' as const, tmdbId: 1, title: 'Dune 3', posterPath: '/dune.jpg' }
const severance = { mediaType: 'tv' as const, tmdbId: 9, title: 'Severance', posterPath: null }

beforeAll(() => setSettings({ tmdb_api_key: 'cle-tmdb' }))

beforeEach(() => {
  getDb().delete(calendarSubscriptions).run()
  clearTmdbCache()
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})

afterEach(() => vi.restoreAllMocks())

describe('abonnements au calendrier', () => {
  it('sont propres à chaque compte et ne se doublent pas', () => {
    setSubscription(1, dune, true)
    setSubscription(1, dune, true)
    setSubscription(2, severance, true)
    expect(listSubscriptions(1).map((item) => item.tmdbId)).toEqual([1])
    expect(isSubscribed(2, 'movie', 1)).toBe(false)
    setSubscription(1, dune, false)
    expect(listSubscriptions(1)).toEqual([])
  })

  it('donnent les sorties TMDB de la période, et comptent ceux que TMDB n\'a pas pu lire', async () => {
    setSubscription(1, dune, true)
    setSubscription(1, severance, true)
    mockFetch([
      { match: /\/movie\/1\/release_dates/, body: { results: [{ iso_3166_1: 'FR', release_dates: [{ type: 3, release_date: '2026-10-21T00:00:00.000Z' }] }] } },
      { match: /\/movie\/1\?/, body: { id: 1, title: 'Dune 3', poster_path: '/dune-tmdb.jpg', release_date: '2026-10-21' } },
      { match: /\/tv\/9\?/, status: 500, body: { status_message: 'panne' } },
    ])
    const { releases, failed } = await subscriptionReleases(1, '2026-10-01', '2026-10-31')
    expect(releases).toMatchObject([{ kind: 'cinema', date: '2026-10-21', posterPath: '/dune-tmdb.jpg', source: 'subscription' }])
    expect(failed).toBe(1)
  })

  it('ne lisent rien sans clé TMDB', async () => {
    setSubscription(1, dune, true)
    setSettings({ tmdb_api_key: '' })
    const { releases, failed } = await subscriptionReleases(1, '2026-10-01', '2026-10-31')
    expect([releases, failed]).toEqual([[], 1])
    setSettings({ tmdb_api_key: 'cle-tmdb' })
  })
})
