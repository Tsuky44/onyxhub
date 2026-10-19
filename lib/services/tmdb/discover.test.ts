import { describe, expect, it } from 'vitest'
import { discoverParams, sortFor, sortMixed } from './discover'
import { genresForMovies, genresForShows } from './genres'

describe('règles de la découverte', () => {
  it('traduit les champs de tri entre films et séries', () => {
    expect(sortFor('tv', 'title.asc')).toBe('name.asc')
    expect(sortFor('movie', 'first_air_date.desc')).toBe('primary_release_date.desc')
    expect(sortFor('movie')).toBe('popularity.desc')
  })

  it('impose un plancher de votes au tri par note', () => {
    expect(discoverParams('movie', { sortBy: 'vote_average.desc' })['vote_count.gte']).toBe(50)
    expect(discoverParams('movie', {})['vote_count.gte']).toBeUndefined()
  })

  it("ne filtre par plateforme qu'avec une région, la France par défaut", () => {
    const params = discoverParams('movie', { watchProviders: [8, 337] })
    expect(params.with_watch_providers).toBe('8|337')
    expect(params.watch_region).toBe('FR')
  })

  it('traduit Action & Aventure des séries en Action et Aventure des films', () => {
    expect(genresForMovies([10759])).toEqual([28, 12])
    expect(genresForShows([28, 12])).toEqual([10759])
  })

  it('trie le mélange par date en lisant la date de sortie ou de première diffusion', () => {
    const sorted = sortMixed(
      [
        { id: 1, release_date: '2020-01-01', poster_path: null, backdrop_path: null },
        { id: 2, first_air_date: '2023-05-01', poster_path: null, backdrop_path: null },
      ],
      'primary_release_date.desc',
    )
    expect(sorted.map((item) => item.id)).toEqual([2, 1])
  })
})
