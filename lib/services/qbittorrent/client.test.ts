import { beforeEach, describe, expect, it } from 'vitest'
import { mockFetch } from '@/tests/fetch-mock'
import { createQbittorrent, parseVersion, resetQbitSessions, versionAtLeast } from './client'

const config = { baseUrl: 'http://qbit:8081', username: 'admin', password: 'secret' }
const loginOk = { method: 'POST', match: /\/auth\/login$/, body: 'Ok.', headers: { 'set-cookie': 'SID=abc123; HttpOnly; path=/' } }

beforeEach(() => resetQbitSessions())

describe('qBittorrent', () => {
  it('se connecte une fois, avec un Referer, puis réutilise le cookie SID', async () => {
    const { calls } = mockFetch([loginOk, { match: /\/app\/version/, body: 'v5.0.2' }])
    const qbit = createQbittorrent(config)
    expect(await qbit.version()).toBe('v5.0.2')
    await qbit.version()
    expect(calls.filter((call) => call.url.endsWith('/auth/login'))).toHaveLength(1)
    expect(calls[0]!.headers.get('Referer')).toBe('http://qbit:8081/')
    expect(calls[1]!.headers.get('Cookie')).toBe('SID=abc123')
  })

  it('se reconnecte une fois quand la session expire (403)', async () => {
    let first = true
    const { calls, fetchMock } = mockFetch([loginOk, { match: /\/app\/version/, body: 'v5.0.2' }])
    const original = fetchMock.getMockImplementation()!
    fetchMock.mockImplementation(async (input, init) => {
      if (String(input).endsWith('/app/version') && first) {
        first = false
        return new Response('Forbidden', { status: 403 })
      }
      return original(input, init)
    })
    expect(await createQbittorrent(config).version()).toBe('v5.0.2')
    expect(calls.filter((call) => call.url.endsWith('/auth/login'))).toHaveLength(2)
  })

  it('refuse des identifiants faux avec un message clair', async () => {
    mockFetch([{ method: 'POST', match: /\/auth\/login$/, body: 'Fails.' }])
    await expect(createQbittorrent(config).version()).rejects.toThrow('identifiants refusés')
  })

  it('accepte la connexion des qBit récents (204 sans corps)', async () => {
    const { calls, fetchMock } = mockFetch([{ match: /\/app\/version/, body: 'v5.2.0' }])
    const original = fetchMock.getMockImplementation()!
    fetchMock.mockImplementation(async (input, init) => {
      if (String(input).endsWith('/auth/login')) return new Response(null, { status: 204, headers: { 'set-cookie': 'SID=abc123; HttpOnly; path=/' } })
      return original(input, init)
    })
    expect(await createQbittorrent(config).version()).toBe('v5.2.0')
    expect(calls.find((call) => call.url.endsWith('/app/version'))!.headers.get('Cookie')).toBe('SID=abc123')
  })

  it('refuse des identifiants faux renvoyés en 401 par les qBit récents', async () => {
    mockFetch([{ method: 'POST', match: /\/auth\/login$/, status: 401, body: 'Unauthorized' }])
    await expect(createQbittorrent(config).version()).rejects.toThrow('identifiants refusés')
  })

  it("dit quand l'IP est bannie (403 à la connexion)", async () => {
    mockFetch([{ method: 'POST', match: /\/auth\/login$/, status: 403, body: 'Banned' }])
    await expect(createQbittorrent(config).version()).rejects.toThrow('bannie')
  })

  it("signale une réponse qui ne vient pas de qBit plutôt que des identifiants refusés", async () => {
    mockFetch([{ method: 'POST', match: /\/auth\/login$/, body: '<html>Connexion</html>' }])
    await expect(createQbittorrent(config).version()).rejects.toThrow('réponse inattendue')
  })

  it('ne tente pas de connexion sans utilisateur (réseau dispensé d\'authentification)', async () => {
    const { calls } = mockFetch([{ match: /\/app\/version/, body: 'v4.6.7' }])
    await createQbittorrent({ ...config, username: '', password: '' }).version()
    expect(calls.some((call) => call.url.includes('/auth/login'))).toBe(false)
  })

  it('met en pause par /torrents/stop sur qBit 5', async () => {
    const { calls } = mockFetch([
      loginOk,
      { match: /\/app\/webapiVersion/, body: '2.11.2' },
      { method: 'POST', match: /\/torrents\/stop$/, body: '' },
    ])
    await createQbittorrent(config).pause(['h1', 'h2'])
    const stop = calls.find((call) => call.url.endsWith('/torrents/stop'))!
    expect(stop.body).toBe('hashes=h1%7Ch2')
  })

  it('met en pause par /torrents/pause sur qBit 4', async () => {
    const { calls } = mockFetch([
      loginOk,
      { match: /\/app\/webapiVersion/, body: '2.9.3' },
      { method: 'POST', match: /\/torrents\/pause$/, body: '' },
    ])
    await createQbittorrent(config).pause(['h1'])
    expect(calls.some((call) => call.url.endsWith('/torrents/pause'))).toBe(true)
  })

  it('refuse un ajout sans lien ni fichier', async () => {
    await expect(createQbittorrent(config).add({})).rejects.toThrow('magnet')
  })

  it('compare les versions élément par élément', () => {
    expect(versionAtLeast(parseVersion('2.11.0'), [2, 11])).toBe(true)
    expect(versionAtLeast(parseVersion('2.9.10'), [2, 11])).toBe(false)
    expect(versionAtLeast(parseVersion('v3.0'), [2, 11])).toBe(true)
  })
})
