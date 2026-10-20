import { describe, expect, it } from 'vitest'
import { mockFetch } from '@/tests/fetch-mock'
import { announceImport } from './imports'

describe('annonce d’un import à Onyx', () => {
  it('présente la clé d’intégration et nomme le titre et ses fichiers', async () => {
    const { calls } = mockFetch([{ method: 'POST', match: /\/api\/integrations\/onyxhub\/imported$/, status: 202, body: { status: 'queued' } }])
    await announceImport('http://onyx:8080', 'cle', { tmdbId: 603, mediaType: 'movie', paths: ['/films/Matrix.mkv'] })
    expect(calls[0]!.headers.get('Authorization')).toBe('Bearer cle')
    expect(JSON.parse(calls[0]!.body!)).toEqual({ tmdbId: 603, mediaType: 'movie', paths: ['/films/Matrix.mkv'] })
  })

  it('envoie 0 pour une série que Sonarr ne connaît que par TVDB', async () => {
    const { calls } = mockFetch([{ method: 'POST', match: /imported$/, status: 202, body: {} }])
    await announceImport('http://onyx:8080', 'cle', { mediaType: 'tv', paths: [] })
    expect(JSON.parse(calls[0]!.body!)).toMatchObject({ tmdbId: 0, mediaType: 'tv' })
  })
})
