import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { mockFetch } from '@/tests/fetch-mock'
import { createTempDataDir } from '@/tests/temp-db'

createTempDataDir()

const { setSettings } = await import('../settings/store')
const { availabilityBatch } = await import('./media-availability')
const { invalidateSorraaIndex } = await import('./sorraa-availability')

beforeAll(() => {
  setSettings({ sorraa_url: 'http://sorraa:7878', radarr_url: 'http://radarr:7878', radarr_api_key: 'x', sonarr_url: 'http://sonarr:8989', sonarr_api_key: 'y' })
})

afterEach(() => invalidateSorraaIndex())

describe('disponibilité servie à Onyx quand sorraa est branché', () => {
  it('vient de sorraa, en un passage pour la page, sans interroger Radarr ni Sonarr', async () => {
    const { calls } = mockFetch([
      {
        match: /sorraa:7878\/api\/v1\/media\?/,
        body: { items: [{ id: 1, kind: 'movie', tmdbId: 603, monitored: true, units: [{ id: 1, kind: 'movie', status: 'downloaded' }] }] },
      },
      {
        match: /sorraa:7878\/api\/v1\/requests\?/,
        body: { items: [{ id: 9, mediaId: 2, kind: 'series', tmdbId: 1399, state: 'processing', seasons: [{ number: 1, state: 'processing' }] }] },
      },
    ])

    const results = await availabilityBatch([
      { mediaType: 'movie', tmdbId: 603 },
      { mediaType: 'tv', tmdbId: 1399 },
      { mediaType: 'movie', tmdbId: 1 },
    ])

    expect(results.map((availability) => availability.status)).toEqual(['available', 'processing', 'unknown'])
    expect(calls.filter((call) => /radarr|sonarr/.test(call.url))).toEqual([])
    expect(calls).toHaveLength(2)
  })

  it('sorraa injoignable : les cartes restent sans statut au lieu de planter, et Radarr ne prend pas le relais', async () => {
    const { calls } = mockFetch([])

    const results = await availabilityBatch([{ mediaType: 'movie', tmdbId: 603 }])

    expect(results[0]?.status).toBe('unknown')
    expect(calls.filter((call) => /radarr|sonarr/.test(call.url))).toEqual([])
  })
})
