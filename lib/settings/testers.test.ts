import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('../services/onyx/auth', () => ({ pingOnyx: vi.fn() }))

const { tmdbAuth } = await import('./testers')

describe('authentification TMDB', () => {
  it('passe une clé v3 en paramètre', () => {
    expect(tmdbAuth('0123456789abcdef0123456789abcdef')).toEqual({ query: '?api_key=0123456789abcdef0123456789abcdef', headers: {} })
  })

  it('passe un jeton v4 en en-tête Authorization', () => {
    const jwt = `eyJ${'a'.repeat(120)}`
    expect(tmdbAuth(jwt)).toEqual({ query: '', headers: { Authorization: `Bearer ${jwt}` } })
  })
})
