import { beforeEach, describe, expect, it } from 'vitest'
import { mockFetch } from '@/tests/fetch-mock'
import { clearArrCache } from './client'
import { createRadarr } from './radarr'

const config = { baseUrl: 'http://radarr:7878', apiKey: 'cle-radarr' }
const movie = { tmdbId: 603, title: 'Matrix', year: 1999, monitored: true, hasFile: false }
const setup = [
  { match: /\/qualityprofile$/, body: [{ id: 4, name: 'HD-1080p' }] },
  { match: /\/rootfolder$/, body: [{ id: 1, path: '/movies' }] },
]

beforeEach(() => clearArrCache())

describe('Radarr', () => {
  it("s'authentifie par en-tête, jamais dans l'URL", async () => {
    const { calls } = mockFetch([{ match: /\/system\/status/, body: { version: '5.14.0' } }])
    expect(await createRadarr(config).version()).toBe('5.14.0')
    expect(calls[0]!.headers.get('X-Api-Key')).toBe('cle-radarr')
    expect(calls[0]!.url).not.toContain('cle-radarr')
  })

  it("ajoute un film absent avec le premier profil et le premier dossier, puis lance sa recherche", async () => {
    const { calls } = mockFetch([
      ...setup,
      { match: /\/movie\?tmdbId=603/, body: [] },
      { match: /\/movie\/lookup\/tmdb/, body: { ...movie, monitored: false } },
      { method: 'POST', match: /\/movie$/, body: { ...movie, id: 12 } },
      { method: 'POST', match: /\/command$/, body: { id: 1 } },
    ])
    const outcome = await createRadarr(config).requestMovie(603)
    expect(outcome.kind).toBe('added')
    const added = JSON.parse(calls.find((call) => call.method === 'POST' && call.url.endsWith('/movie'))!.body!)
    expect(added).toMatchObject({ qualityProfileId: 4, rootFolderPath: '/movies', monitored: true, addOptions: { searchForMovie: false } })
    const command = JSON.parse(calls.find((call) => call.url.endsWith('/command'))!.body!)
    expect(command).toEqual({ name: 'MoviesSearch', movieIds: [12] })
  })

  it('ne rajoute pas un film déjà demandé', async () => {
    const { calls } = mockFetch([{ match: /\/movie\?tmdbId=603/, body: [{ ...movie, id: 12 }] }])
    expect((await createRadarr(config).requestMovie(603)).kind).toBe('already-requested')
    expect(calls).toHaveLength(1)
  })

  it('dit disponible un film qui a déjà son fichier', async () => {
    mockFetch([{ match: /\/movie\?tmdbId=603/, body: [{ ...movie, id: 12, hasFile: true }] }])
    expect((await createRadarr(config).requestMovie(603)).kind).toBe('available')
  })

  it('surveille et recherche un film présent mais ignoré', async () => {
    const { calls } = mockFetch([
      { match: /\/movie\?tmdbId=603/, body: [{ ...movie, id: 12, monitored: false }] },
      { method: 'PUT', match: /\/movie\/12$/, body: { ...movie, id: 12 } },
      { method: 'POST', match: /\/command$/, body: { id: 1 } },
    ])
    expect((await createRadarr(config).requestMovie(603)).kind).toBe('monitored')
    expect(JSON.parse(calls.find((call) => call.method === 'PUT')!.body!).monitored).toBe(true)
  })

  it('remonte le message de validation de Radarr', async () => {
    mockFetch([
      ...setup,
      { match: /\/movie\?tmdbId=603/, body: [] },
      { match: /\/movie\/lookup\/tmdb/, body: movie },
      { method: 'POST', match: /\/movie$/, status: 400, body: [{ errorMessage: 'Root folder path is not writable', errorCode: 'X' }] },
    ])
    await expect(createRadarr(config).requestMovie(603)).rejects.toThrow('Radarr : Root folder path is not writable')
  })

  it('lit la file avec ou sans pagination', async () => {
    mockFetch([{ match: /\/queue\?/, body: { records: [{ id: 1, title: 'x', status: 'downloading', size: 10, sizeleft: 5 }] } }])
    expect(await createRadarr(config).queue()).toHaveLength(1)
  })
})
