import { describe, expect, it } from 'vitest'
import { mockFetch } from '@/tests/fetch-mock'
import { createOnyxWatchLater } from './lists'

const LISTS = { mine: [{ id: 3, kind: 'custom' }, { id: 7, kind: 'watch_later' }], shared: [] }

describe('« À regarder plus tard » tenu par Onyx', () => {
  it("lit la liste du compte et parle le vocabulaire d'OnyxHub (tv, chemin d'affiche TMDB)", async () => {
    const { calls } = mockFetch([
      { match: /\/api\/lists$/, body: LISTS },
      {
        match: /\/api\/lists\/7$/,
        body: {
          items: [
            { id: 1, media_type: 'show', tmdb_id: 1399, title: 'Game of Thrones', poster_url: 'https://image.tmdb.org/t/p/w500/got.jpg' },
            { id: 2, media_type: 'movie', tmdb_id: 603, title: 'Matrix', poster_url: '/api/media/12/poster' },
            // Ajouté depuis le serveur sans identité TMDB : OnyxHub n'a pas de fiche à lui montrer.
            { id: 3, media_type: 'movie', tmdb_id: 0, title: 'Vidéo de vacances' },
          ],
        },
      },
    ])
    const items = await createOnyxWatchLater('http://onyx:8080', 'jeton').items()
    expect(items).toEqual([
      { id: 1, mediaType: 'tv', tmdbId: 1399, title: 'Game of Thrones', posterPath: '/got.jpg' },
      { id: 2, mediaType: 'movie', tmdbId: 603, title: 'Matrix', posterPath: null },
    ])
    expect(calls[0]!.headers.get('Authorization')).toBe('Bearer jeton')
  })

  it('ajoute un titre du catalogue avec son identité TMDB', async () => {
    const { calls } = mockFetch([
      { match: /\/api\/lists$/, body: LISTS },
      { method: 'POST', match: /\/api\/lists\/7\/items$/, status: 201, body: {} },
    ])
    await createOnyxWatchLater('http://onyx:8080', 't').add({ mediaType: 'tv', tmdbId: 1399, title: 'GoT', posterPath: null })
    expect(JSON.parse(calls[1]!.body!)).toEqual({ tmdb_id: 1399, media_type: 'tv', title: 'GoT', poster_path: '' })
  })

  it('retire un titre par son élément de liste', async () => {
    const { calls } = mockFetch([
      { match: /\/api\/lists$/, body: LISTS },
      { method: 'DELETE', match: /\/api\/lists\/7\/items\/42$/, body: {} },
    ])
    await createOnyxWatchLater('http://onyx:8080', 't').remove(42)
    expect(calls.map((call) => call.method)).toEqual(['GET', 'DELETE'])
  })
})
