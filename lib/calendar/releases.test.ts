import { describe, expect, it } from 'vitest'
import type { RadarrCalendarMovie, SonarrCalendarEpisode } from '../services/arr/types'
import { episodeReleases, groupEpisodeDrops, mergeReleases, movieReleases, sortReleases, tmdbPosterPath, type Release } from './releases'

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
    const base = { kind: 'episode' as const, mediaType: 'tv' as const, tmdbId: 1, subtitle: null, posterPath: null, hasFile: false, episode: null, source: 'library' as const }
    const sorted = sortReleases([
      { ...base, id: 'b', date: '2026-10-02', title: 'B' },
      { ...base, id: 'c', date: '2026-10-01', title: 'C' },
      { ...base, id: 'a', date: '2026-10-02', title: 'A' },
    ])
    expect(sorted.map((release) => release.id)).toEqual(['c', 'a', 'b'])
  })
})

const episodeRelease = (number: number, fields: Partial<Release> = {}): Release => ({
  id: `episode-${number}`,
  date: '2026-10-20',
  kind: 'episode',
  mediaType: 'tv',
  tmdbId: 1399,
  title: 'GoT',
  subtitle: `S02E0${number}`,
  posterPath: null,
  hasFile: false,
  episode: { season: 2, number },
  source: 'library',
  ...fields,
})

describe("saisons sorties d'un coup", () => {
  it("regroupe les épisodes d'une même saison sortis le même jour", () => {
    const [drop, ...rest] = groupEpisodeDrops([episodeRelease(1), episodeRelease(2), episodeRelease(3)])
    expect(rest).toHaveLength(0)
    expect(drop).toMatchObject({ subtitle: 'S02 · Épisodes 1 à 3', hasFile: false })
  })

  it('compte les épisodes quand ils ne se suivent pas, et ne dit disponible que si tous le sont', () => {
    const [drop] = groupEpisodeDrops([episodeRelease(1, { hasFile: true }), episodeRelease(4, { hasFile: true })])
    expect(drop).toMatchObject({ subtitle: 'S02 · 2 épisodes', hasFile: true })
  })

  it('laisse seul un épisode unique ou sorti un autre jour', () => {
    const releases = groupEpisodeDrops([episodeRelease(1), episodeRelease(2, { date: '2026-10-27' })])
    expect(releases.map((release) => release.subtitle)).toEqual(['S02E01', 'S02E02'])
  })
})

describe('abonnements et serveur', () => {
  it('garde la sortie du serveur quand un abonnement donne la même', () => {
    const library = episodeRelease(1, { hasFile: true })
    const subscribed = episodeRelease(1, { id: 'tmdb-1', source: 'subscription' })
    const other = episodeRelease(2, { id: 'tmdb-2', source: 'subscription' })
    expect(mergeReleases([library], [subscribed, other]).map((release) => release.id)).toEqual(['episode-1', 'tmdb-2'])
  })
})
