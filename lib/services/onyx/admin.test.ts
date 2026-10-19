import { describe, expect, it } from 'vitest'
import { mockFetch } from '@/tests/fetch-mock'
import { createOnyxAdmin } from './admin'

describe('Onyx admin', () => {
  it('relaie le jeton du compte connecté, Onyx vérifiant lui-même ses droits', async () => {
    const { calls } = mockFetch([{ match: /\/api\/admin\/activity$/, body: [] }])
    await createOnyxAdmin('http://onyx:8080', 'jeton-onyx').nowPlaying()
    expect(calls[0]!.headers.get('Authorization')).toBe('Bearer jeton-onyx')
  })

  it('borne la période des stats entre 1 et 365 jours, comme Onyx', async () => {
    const { calls } = mockFetch([{ match: /\/api\/admin\/stats/, body: {} }])
    await createOnyxAdmin('http://onyx:8080', 't').stats(1_000)
    expect(new URL(calls[0]!.url).searchParams.get('days')).toBe('365')
  })

  it('remonte un refus de droits comme un accès refusé', async () => {
    mockFetch([{ match: /\/api\/admin\/server$/, status: 403, body: { error: 'forbidden' } }])
    await expect(createOnyxAdmin('http://onyx:8080', 't').server()).rejects.toThrow('accès refusé')
  })
})
