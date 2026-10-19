import { beforeEach, describe, expect, it } from 'vitest'
import { mockFetch } from '@/tests/fetch-mock'
import { clearArrCache } from './client'
import { createSonarr } from './sonarr'

const config = { baseUrl: 'http://sonarr:8989', apiKey: 'cle-sonarr' }
const seasons = [
  { seasonNumber: 0, monitored: false },
  { seasonNumber: 1, monitored: false },
  { seasonNumber: 2, monitored: false },
]
const series = { tvdbId: 121361, title: 'Game of Thrones', monitored: true, seasons }

beforeEach(() => clearArrCache())

function commands(calls: { url: string; body: string | null }[]) {
  return calls.filter((call) => call.url.endsWith('/command')).map((call) => JSON.parse(call.body!))
}

describe('Sonarr', () => {
  it("ajoute une série absente en ne surveillant que la saison demandée", async () => {
    const { calls } = mockFetch([
      { match: /\/series\?tvdbId=/, body: [] },
      { match: /\/series\/lookup/, body: [series] },
      { match: /\/qualityprofile$/, body: [{ id: 6, name: 'HD' }] },
      { match: /\/rootfolder$/, body: [{ id: 1, path: '/tv' }] },
      { match: /\/languageprofile$/, status: 404, body: {} },
      { method: 'POST', match: /\/series$/, body: { ...series, id: 40 } },
      { method: 'POST', match: /\/command$/, body: { id: 1 } },
    ])
    const outcome = await createSonarr(config).requestSeasons(121361, [2])
    expect(outcome).toMatchObject({ kind: 'added', seasons: [2] })
    const body = JSON.parse(calls.find((call) => call.method === 'POST' && call.url.endsWith('/series'))!.body!)
    expect(body.seasons.map((s: { monitored: boolean }) => s.monitored)).toEqual([false, false, true])
    expect(body.languageProfileId).toBeUndefined()
    expect(commands(calls)).toEqual([{ name: 'SeasonSearch', seriesId: 40, seasonNumber: 2 }])
  })

  it('ajoute une saison à une série existante sans retirer les précédentes', async () => {
    const existing = { ...series, id: 40, seasons: [{ seasonNumber: 1, monitored: true }, { seasonNumber: 2, monitored: false }] }
    const { calls } = mockFetch([
      { match: /\/series\?tvdbId=/, body: [existing] },
      { method: 'PUT', match: /\/series\/40$/, body: existing },
      { method: 'POST', match: /\/command$/, body: { id: 1 } },
    ])
    const outcome = await createSonarr(config).requestSeasons(121361, [2])
    expect(outcome).toMatchObject({ kind: 'seasons-added', seasons: [2] })
    const put = JSON.parse(calls.find((call) => call.method === 'PUT')!.body!)
    expect(put.seasons.map((s: { monitored: boolean }) => s.monitored)).toEqual([true, true])
    expect(commands(calls)).toEqual([{ name: 'SeasonSearch', seriesId: 40, seasonNumber: 2 }])
  })

  it('ne touche à rien quand toutes les saisons demandées sont déjà surveillées', async () => {
    const existing = { ...series, id: 40, seasons: [{ seasonNumber: 1, monitored: true }] }
    const { calls } = mockFetch([{ match: /\/series\?tvdbId=/, body: [existing] }])
    expect((await createSonarr(config).requestSeasons(121361, [1])).kind).toBe('already-requested')
    expect(calls).toHaveLength(1)
  })

  it('cherche les releases d\'une saison entière', async () => {
    const { calls } = mockFetch([{ match: /\/release\?/, body: [] }])
    await createSonarr(config).releases({ seriesId: 40, seasonNumber: 2 })
    const url = new URL(calls[0]!.url)
    expect(url.searchParams.get('seriesId')).toBe('40')
    expect(url.searchParams.get('seasonNumber')).toBe('2')
  })
})
