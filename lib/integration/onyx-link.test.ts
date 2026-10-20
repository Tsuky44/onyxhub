import { describe, expect, it } from 'vitest'
import { mockFetch } from '@/tests/fetch-mock'
import { createOnyxSettings } from '../services/onyx/settings'
import { compareLink } from './onyx-link'

const KEY = 'cle-integration-abcd'

describe('liaison Onyx → OnyxHub', () => {
  it('reconnaît notre clé aux 4 derniers caractères que rend Onyx', () => {
    expect(compareLink({ url: 'http://hub:4400/', keySet: true, keyHint: '••••abcd' }, KEY, null)).toEqual({ kind: 'linked', onyxUrl: 'http://hub:4400' })
    expect(compareLink({ url: 'http://hub:4400', keySet: true, keyHint: '••••zzzz' }, KEY, null).kind).toBe('stale-key')
    expect(compareLink({ url: 'http://hub:4400', keySet: false, keyHint: null }, KEY, null).kind).toBe('stale-key')
  })

  it("ne juge l'adresse d'Onyx que si l'admin l'a fixée", () => {
    const onyx = { url: 'http://onyxhub:4400', keySet: true, keyHint: '••••abcd' }
    expect(compareLink(onyx, KEY, null).kind).toBe('linked')
    expect(compareLink(onyx, KEY, 'http://onyxhub:4400').kind).toBe('linked')
    expect(compareLink(onyx, KEY, 'http://192.168.1.10:4400').kind).toBe('elsewhere')
  })

  it("dit qu'Onyx n'est pas relié tant qu'il n'a pas d'adresse", () => {
    expect(compareLink({ url: '', keySet: true, keyHint: '••••abcd' }, KEY, null).kind).toBe('not-set')
  })

  it("écrit l'adresse et la clé dans les réglages d'Onyx avec le jeton de l'admin", async () => {
    const { calls } = mockFetch([{ method: 'PUT', match: /\/api\/settings$/, body: {} }])
    await createOnyxSettings('http://onyx:8080', 'jeton-admin').pointToHub('http://hub:4400', KEY)
    expect(calls[0]!.headers.get('Authorization')).toBe('Bearer jeton-admin')
    expect(JSON.parse(calls[0]!.body!)).toEqual({ mediahub_url: 'http://hub:4400', mediahub_api_key: KEY })
  })

  it("prend un Onyx qui ne sait pas tester la liaison pour un Onyx ancien, pas pour une panne", async () => {
    mockFetch([{ method: 'POST', match: /\/api\/settings\/mediahub\/test$/, status: 404, body: '404 page not found' }])
    await expect(createOnyxSettings('http://onyx:8080', 't').testHub()).resolves.toBeNull()
    mockFetch([{ method: 'POST', match: /\/api\/settings\/mediahub\/test$/, status: 500, body: {} }])
    await expect(createOnyxSettings('http://onyx:8080', 't').testHub()).rejects.toThrow()
  })
})
