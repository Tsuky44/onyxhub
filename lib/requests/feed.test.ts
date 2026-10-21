import { beforeEach, describe, expect, it } from 'vitest'
import { createTempDataDir } from '@/tests/temp-db'

createTempDataDir()

const { getDb } = await import('../db')
const { mediaRequests } = await import('../db/schema')
const { insertMissing } = await import('./repository')
const { FEED_LIMIT, requestFeed } = await import('./feed')

const admin = { name: 'admin', id: 1 }

function request(tmdbId: number, requester: string, requesterId: number | null, seasons: (number | null)[] = [null]) {
  const now = new Date('2026-10-21T09:00:00.000Z')
  const batchId = `lot-${tmdbId}`
  return insertMissing(
    seasons.map((seasonNumber) => ({
      mediaType: seasonNumber === null ? ('movie' as const) : ('tv' as const),
      tmdbId,
      seasonNumber,
      tvdbId: null,
      title: `Titre ${tmdbId}`,
      posterPath: null,
      status: 'approved' as const,
      requester,
      requesterId,
      batchId,
      requestedAt: now,
      updatedAt: now,
    })),
  )
}

beforeEach(() => {
  getDb().delete(mediaRequests).run()
})

describe('flux des nouvelles demandes', () => {
  it('le premier passage pose le curseur au bout sans rien annoncer', () => {
    request(603, 'lea', 2)
    const feed = requestFeed(null, admin)
    expect(feed.requests).toEqual([])
    expect(requestFeed(feed.cursor, admin).requests).toEqual([])
  })

  it('annonce une série d’un seul tenant, avec ses saisons et son demandeur', () => {
    const { cursor } = requestFeed(null, admin)
    request(1399, 'hugo', 3, [2, 1])
    const feed = requestFeed(cursor, admin)
    expect(feed.requests).toMatchObject([{ mediaType: 'tv', tmdbId: 1399, seasons: [1, 2], requester: 'hugo' }])
    expect(requestFeed(feed.cursor, admin).requests).toEqual([])
  })

  it('tait les demandes de l’administrateur qui relève le flux, mais avance le curseur', () => {
    const { cursor } = requestFeed(null, admin)
    request(603, 'admin-renomme', 1)
    request(604, 'admin', null)
    const feed = requestFeed(cursor, admin)
    expect(feed.requests).toEqual([])
    expect(feed.cursor).toBeGreaterThan(cursor)
  })

  it(`ne rend que les ${FEED_LIMIT} plus récentes, les plus anciennes d’abord`, () => {
    const { cursor } = requestFeed(null, admin)
    for (let tmdbId = 1; tmdbId <= FEED_LIMIT + 5; tmdbId++) request(tmdbId, 'lea', 2)
    const { requests } = requestFeed(cursor, admin)
    expect(requests).toHaveLength(FEED_LIMIT)
    expect(requests[0]?.tmdbId).toBe(6)
    expect(requests.at(-1)?.tmdbId).toBe(FEED_LIMIT + 5)
  })
})
