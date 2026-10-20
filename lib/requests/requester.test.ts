import { beforeEach, describe, expect, it } from 'vitest'
import { createTempDataDir } from '@/tests/temp-db'

createTempDataDir()

const { getDb } = await import('../db')
const { mediaRequests } = await import('../db/schema')
const { forgetRequesters, rememberRequester } = await import('./requester')

function insert(requester: string, requesterId: number | null, tmdbId: number) {
  const now = new Date()
  getDb()
    .insert(mediaRequests)
    .values({ mediaType: 'movie', tmdbId, seasonNumber: null, tvdbId: null, title: `Film ${tmdbId}`, posterPath: null, status: 'approved', requester, requesterId, batchId: `b${tmdbId}`, requestedAt: now, updatedAt: now })
    .run()
}

function owners() {
  return getDb()
    .select({ tmdbId: mediaRequests.tmdbId, requester: mediaRequests.requester, requesterId: mediaRequests.requesterId })
    .from(mediaRequests)
    .orderBy(mediaRequests.tmdbId)
    .all()
}

describe('les demandes suivent le compte Onyx, pas son nom', () => {
  beforeEach(() => {
    getDb().delete(mediaRequests).run()
    forgetRequesters()
  })

  it('rattache au compte les demandes faites sous son nom avant l’identifiant', () => {
    insert('lea', null, 1)
    insert('marc', null, 2)
    rememberRequester(7, 'lea')
    expect(owners()).toEqual([
      { tmdbId: 1, requester: 'lea', requesterId: 7 },
      { tmdbId: 2, requester: 'marc', requesterId: null },
    ])
  })

  it('un compte renommé dans Onyx garde ses demandes, sous son nouveau nom', () => {
    insert('lea', 7, 1)
    insert('lea', null, 2)
    rememberRequester(7, 'léa')
    // La demande sans identifiant reste à l’ancien nom : rien ne dit qu’elle était à ce compte.
    expect(owners()).toEqual([
      { tmdbId: 1, requester: 'léa', requesterId: 7 },
      { tmdbId: 2, requester: 'lea', requesterId: null },
    ])
  })
})
