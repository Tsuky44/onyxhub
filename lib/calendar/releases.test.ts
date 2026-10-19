import { describe, expect, it } from 'vitest'
import type { RadarrCalendarMovie, SonarrCalendarEpisode } from '../services/arr/types'
import { episodeReleases, movieReleases, sortReleases, tmdbPosterPath } from './releases'

const movie = (fields: Partial<RadarrCalendarMovie>): RadarrCalendarMovie => ({
  id: 1,
  tmdbId: 603,
  title: 'Matrix',
  year: 1999,
  monitored: true,
  hasFile: false,
  ...fields,
})

describe('sorties Radarr', () => {
  it('donne une ligne par type de sortie compris dans la période', () => {
    const releases = movieReleases(
      [movie({ inCinemas: '2026-10-01T00:00:00Z', digitalRelease: '2026-10-20T00:00:00Z', physicalRelease: '2026-12-01T00:00:00Z' })],
      '2026-10-15',
      '2026-11-15',
    )
    expect(releases.map((release) => [release.kind, release.date])).toEqual([['digital', '2026-10-20']])
  })

  it('garde le jour donné par Radarr, sans décalage de fuseau', () => {
    expect(movieReleases([movie({ digitalRelease: '2026-10-20T00:00:00Z' })], '2026-10-20', '2026-10-20')).toHaveLength(1)
  })

  it("prend l'affiche TMDB des images Radarr, pas celle de TVDB", () => {
    expect(tmdbPosterPath([{ coverType: 'poster', remoteUrl: 'https://image.tmdb.org/t/p/original/abc.jpg' }])).toBe('/abc.jpg')
    expect(tmdbPosterPath([{ coverType: 'poster', remoteUrl: 'https://artworks.thetvdb.com/x.jpg' }])).toBeNull()
  })
})

describe('sorties Sonarr', () => {
  it("écrit le code de l'épisode et son titre", () => {
    const episode: SonarrCalendarEpisode = {
      id: 9,
      seriesId: 40,
      seasonNumber: 2,
      episodeNumber: 5,
      title: 'Le Nord',
      airDateUtc: '2026-10-21T20:00:00Z',
      hasFile: false,
      monitored: true,
      series: { tvdbId: 1, tmdbId: 1399, title: 'GoT', monitored: true, seasons: [] },
    }
    const [release] = episodeReleases([episode], '2026-10-01', '2026-10-31')
    expect(release).toMatchObject({ kind: 'episode', tmdbId: 1399, title: 'GoT', subtitle: 'S02E05 · Le Nord' })
  })

  it('trie par date puis par titre', () => {
    const base = { kind: 'episode' as const, mediaType: 'tv' as const, tmdbId: 1, subtitle: null, posterPath: null, hasFile: false }
    const sorted = sortReleases([
      { ...base, id: 'b', date: '2026-10-02', title: 'B' },
      { ...base, id: 'c', date: '2026-10-01', title: 'C' },
      { ...base, id: 'a', date: '2026-10-02', title: 'A' },
    ])
    expect(sorted.map((release) => release.id)).toEqual(['c', 'a', 'b'])
  })
})
