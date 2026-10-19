import { beforeEach, describe, expect, it } from 'vitest'
import { mockFetch } from '@/tests/fetch-mock'
import { clearArrCache } from '../services/arr/client'
import { createQbittorrent, resetQbitSessions } from '../services/qbittorrent/client'
import { testService } from './testers'

beforeEach(() => {
  clearArrCache()
  resetQbitSessions()
})

describe('bouton Tester', () => {
  it('donne la version de Radarr quand tout répond', async () => {
    mockFetch([{ match: /radarr:7878\/api\/v3\/system\/status/, body: { version: '5.14.0' } }])
    expect(await testService('radarr', { radarr_url: 'http://radarr:7878', radarr_api_key: 'k' })).toEqual({
      ok: true,
      message: 'Radarr 5.14.0 répond.',
    })
  })

  it('signale une clé manquante sans appeler le service', async () => {
    const { calls } = mockFetch([])
    const result = await testService('sonarr', { sonarr_url: 'http://sonarr:8989' })
    expect(result).toEqual({ ok: false, message: 'Il manque la clé API de Sonarr' })
    expect(calls).toHaveLength(0)
  })

  it("teste un nouveau mot de passe qBit même si une ancienne session est ouverte", async () => {
    mockFetch([
      { method: 'POST', match: /\/auth\/login$/, body: 'Ok.', headers: { 'set-cookie': 'SID=old' } },
      { match: /\/app\/version/, body: 'v5.0.2' },
    ])
    // Une session commune s'ouvre avec le bon mot de passe…
    await createQbittorrent({ baseUrl: 'http://qbit:8081', username: 'admin', password: 'bon' }).version()
    // …puis le test d'un mot de passe faux doit se reconnecter, et échouer.
    mockFetch([{ method: 'POST', match: /\/auth\/login$/, body: 'Fails.' }])
    const result = await testService('qbittorrent', { qbittorrent_url: 'http://qbit:8081', qbittorrent_username: 'admin', qbittorrent_password: 'faux' })
    expect(result).toEqual({ ok: false, message: 'qBittorrent : identifiants refusés' })
  })

  it("dit qu'il n'y a pas de test pour un service qui n'en a pas", async () => {
    expect((await testService('smb', {})).ok).toBe(false)
  })
})
