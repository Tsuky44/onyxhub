import { describe, expect, it } from 'vitest'
import { mockFetch } from '@/tests/fetch-mock'
import { fetchOnyxLibrary } from '../services/onyx/library'
import { onyxMediaId, withOnyxPresence } from './onyx-presence'

describe('ce qu’Onyx a déjà', () => {
  it('lit l’index d’Onyx et sépare films et séries de même identifiant TMDB', async () => {
    mockFetch([{ match: /\/api\/library\/tmdb-index$/, body: { movies: { '603': 12, oops: 4 }, shows: { '603': 40 } } }])
    const index = await fetchOnyxLibrary('http://onyx:8080', 't')
    expect(onyxMediaId(index, 'movie', 603)).toBe(12)
    expect(onyxMediaId(index, 'tv', 603)).toBe(40)
    expect(onyxMediaId(index, 'movie', 1)).toBeNull()
    expect(index.movies.size).toBe(1)
  })

  it('rend disponible un titre qu’Onyx a et que Radarr/Sonarr ne connaissent pas', () => {
    expect(withOnyxPresence('unknown', true)).toBe('available')
    expect(withOnyxPresence('unknown', false)).toBe('unknown')
  })

  it('laisse Radarr/Sonarr décider dès qu’ils connaissent le titre', () => {
    expect(withOnyxPresence('partial', true)).toBe('partial')
    expect(withOnyxPresence('processing', true)).toBe('processing')
  })

  it('sans index (Onyx ancien ou muet), rien n’est réputé dans Onyx', () => {
    expect(onyxMediaId(null, 'movie', 603)).toBeNull()
  })
})
