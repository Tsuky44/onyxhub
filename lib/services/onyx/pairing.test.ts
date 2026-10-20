import { describe, expect, it } from 'vitest'
import { mockFetch } from '@/tests/fetch-mock'
import { pollPairing, startPairing } from './pairing'

const USER = { id: 3, username: 'lea', is_owner: false, otp_enabled: false, permissions: {} }

describe('connexion par l’app Onyx', () => {
  it('ouvre un appairage au nom d’OnyxHub', async () => {
    const { calls } = mockFetch([
      { method: 'POST', match: /\/api\/auth\/device\/start$/, body: { device_code: 'prive', user_code: 'ABCDEFGH', expires_in: 300, interval: 2 } },
    ])
    expect(await startPairing('http://onyx:8080', 'OnyxHub (navigateur)')).toEqual({ deviceCode: 'prive', userCode: 'ABCDEFGH', expiresIn: 300, interval: 2 })
    expect(JSON.parse(calls[0]!.body!)).toEqual({ device_name: 'OnyxHub (navigateur)' })
  })

  it('rend la session une fois le code approuvé depuis le téléphone', async () => {
    mockFetch([{ method: 'POST', match: /\/api\/auth\/device\/poll$/, body: { status: 'approved', token: 'jeton', user: USER } }])
    expect(await pollPairing('http://onyx:8080', 'prive')).toMatchObject({ status: 'approved', token: 'jeton', user: { username: 'lea' } })
  })

  it('attend tant que personne n’a approuvé, et traite un refus comme une expiration', async () => {
    mockFetch([{ method: 'POST', match: /poll$/, body: { status: 'pending' } }])
    expect(await pollPairing('http://onyx:8080', 'prive')).toEqual({ status: 'pending' })
    mockFetch([{ method: 'POST', match: /poll$/, body: { status: 'denied' } }])
    expect(await pollPairing('http://onyx:8080', 'prive')).toEqual({ status: 'expired' })
  })
})
