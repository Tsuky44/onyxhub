import { describe, expect, it } from 'vitest'
import type { TmdbSeason, TmdbSeasonSummary } from '../services/tmdb/types'
import { isSubscribable, seasonsOverlapping, tmdbEpisodeReleases, tmdbMovieReleases } from './tmdb-releases'

const movie = { tmdbId: 1, title: 'Dune 3', posterPath: '/dune.jpg' }

describe('sorties TMDB d\'un film suivi par abonnement', () => {
  it('prend les dates françaises, la plus tôt par type de sortie', () => {
    const releases = tmdbMovieReleases(
      movie,
      {
        results: [
          { iso_3166_1: 'US', release_dates: [{ type: 3, release_date: '2026-10-01T00:00:00.000Z' }] },
          {
            iso_3166_1: 'FR',
            release_dates: [
              { type: 3, release_date: '2026-10-21T00:00:00.000Z' },
              { type: 2, release_date: '2026-10-18T00:00:00.000Z' },
              { type: 4, release_date: '2027-02-01T00:00:00.000Z' },
            ],
          },
        ],
      },
      '2026-10-01',
      '2026-10-01',
      '2027-03-01',
    )
    expect(releases.map((release) => [release.kind, release.date])).toEqual([
      ['cinema', '2026-10-18'],
      ['digital', '2027-02-01'],
    ])
    expect(releases[0]).toMatchObject({ source: 'subscription', hasFile: false })
  })

  it('se rabat sur les dates américaines, puis sur la date de la fiche', () => {
    const us = tmdbMovieReleases(movie, { results: [{ iso_3166_1: 'US', release_dates: [{ type: 4, release_date: '2026-11-02T00:00:00.000Z' }] }] }, null, '2026-11-01', '2026-11-30')
    expect(us.map((release) => release.kind)).toEqual(['digital'])
    const fallback = tmdbMovieReleases(movie, { results: [] }, '2026-11-05', '2026-11-01', '2026-11-30')
    expect(fallback.map((release) => [release.kind, release.date])).toEqual([['cinema', '2026-11-05']])
  })
})

const season = (number: number, airDate: string | null): TmdbSeasonSummary => ({
  id: number,
  season_number: number,
  name: `Saison ${number}`,
  episode_count: 8,
  air_date: airDate,
  poster_path: null,
})

describe('saisons à lire pour une période', () => {
  const seasons = [season(0, '2010-01-01'), season(1, '2020-01-10'), season(2, '2022-03-01'), season(3, '2026-10-10'), season(4, null)]

  it('lit la saison en cours de diffusion, pas toutes', () => {
    expect(seasonsOverlapping(seasons, '2026-10-01', '2026-10-31')).toEqual([2, 3])
    expect(seasonsOverlapping(seasons, '2026-11-01', '2026-11-30')).toEqual([3])
  })

  it('ignore les épisodes spéciaux et les saisons sans date', () => {
    expect(seasonsOverlapping(seasons, '2009-01-01', '2009-12-31')).toEqual([])
  })
})

describe('épisodes TMDB', () => {
  it('ne garde que les épisodes de la période, avec leur code', () => {
    const data: TmdbSeason = {
      ...season(3, '2026-10-10'),
      episodes: [
        { id: 1, season_number: 3, episode_number: 1, name: 'Retour', air_date: '2026-10-10', still_path: null },
        { id: 2, season_number: 3, episode_number: 2, name: '', air_date: '2026-11-17', still_path: null },
        { id: 3, season_number: 3, episode_number: 3, name: 'Fin', air_date: null, still_path: null },
      ],
    }
    const releases = tmdbEpisodeReleases({ tmdbId: 9, title: 'Severance', posterPath: null }, data, '2026-10-01', '2026-11-30')
    expect(releases.map((release) => release.subtitle)).toEqual(['S03E01 · Retour', 'S03E02'])
  })
})

describe('bouton « S\'abonner »', () => {
  it('apparaît pour une série en production, pas pour une série terminée', () => {
    expect(isSubscribable('tv', { status: 'Returning Series' }, '2026-10-19')).toBe(true)
    expect(isSubscribable('tv', { status: 'Ended', in_production: false }, '2026-10-19')).toBe(false)
  })

  it('apparaît pour un film à venir ou sorti depuis moins de six mois', () => {
    expect(isSubscribable('movie', { status: 'Post Production' }, '2026-10-19')).toBe(true)
    expect(isSubscribable('movie', { status: 'Released', release_date: '2026-06-01' }, '2026-10-19')).toBe(true)
    expect(isSubscribable('movie', { status: 'Released', release_date: '1999-03-30' }, '2026-10-19')).toBe(false)
  })
})
