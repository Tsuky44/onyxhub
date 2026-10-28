import { describe, expect, it } from 'vitest'
import type { SorraaLibraryMedia, SorraaRequest, SorraaState, SorraaUnit } from '../services/sorraa/client'
import { buildSorraaIndex, sorraaAvailabilityIn } from './sorraa-availability'

const movie = (tmdbId: number, status: SorraaUnit['status']): SorraaLibraryMedia => ({
  id: tmdbId,
  kind: 'movie',
  tmdbId,
  monitored: true,
  units: [{ id: 1, kind: 'movie', status }],
})

/** Une série dont chaque saison est `[épisodes téléchargés, épisodes en tout]`. */
const series = (tmdbId: number, seasons: Record<number, [number, number]>): SorraaLibraryMedia => ({
  id: tmdbId,
  kind: 'series',
  tmdbId,
  monitored: true,
  units: Object.entries(seasons).flatMap(([season, [downloaded, total]]) =>
    Array.from({ length: total }, (_, index): SorraaUnit => ({
      id: Number(season) * 100 + index,
      kind: 'episode',
      seasonNumber: Number(season),
      episodeNumber: index + 1,
      status: index < downloaded ? 'downloaded' : 'missing',
    })),
  ),
})

const request = (tmdbId: number, kind: 'movie' | 'series', state: SorraaState, seasons: Record<number, SorraaState> = {}): SorraaRequest => ({
  id: tmdbId,
  mediaId: tmdbId,
  kind,
  tmdbId,
  state,
  ...(kind === 'series' ? { seasons: Object.entries(seasons).map(([number, seasonState]) => ({ number: Number(number), state: seasonState })) } : {}),
})

describe('disponibilité d’après sorraa', () => {
  it('un film dont sorraa a le fichier est disponible, sans Radarr', () => {
    const index = buildSorraaIndex([movie(603, 'downloaded')], [])

    expect(sorraaAvailabilityIn(index, 'movie', 603)).toMatchObject({ status: 'available', available: true })
  })

  it('un film absent de sorraa, ou sans demande ni fichier, reste inconnu', () => {
    const index = buildSorraaIndex([movie(604, 'missing')], [])

    expect(sorraaAvailabilityIn(index, 'movie', 603).status).toBe('unknown')
    expect(sorraaAvailabilityIn(index, 'movie', 604).status).toBe('unknown')
  })

  it('suit la demande d’un film tant que le fichier manque', () => {
    const pending = buildSorraaIndex([movie(603, 'missing')], [request(603, 'movie', 'pending')])
    const downloading = buildSorraaIndex([movie(603, 'missing')], [request(603, 'movie', 'processing')])

    expect(sorraaAvailabilityIn(pending, 'movie', 603).status).toBe('pending')
    expect(sorraaAvailabilityIn(downloading, 'movie', 603).status).toBe('processing')
  })

  it('un film et une série qui partagent un identifiant TMDB ne se mélangent pas', () => {
    const index = buildSorraaIndex([movie(1399, 'downloaded'), series(1399, { 1: [0, 3] })], [])

    expect(sorraaAvailabilityIn(index, 'movie', 1399).status).toBe('available')
    expect(sorraaAvailabilityIn(index, 'tv', 1399).status).toBe('unknown')
  })

  it('compte les épisodes de chaque saison : complète, entamée, absente', () => {
    const index = buildSorraaIndex([series(1399, { 1: [10, 10], 2: [4, 10], 3: [0, 10] })], [])

    const availability = sorraaAvailabilityIn(index, 'tv', 1399)

    expect(availability.seasons.map((season) => [season.seasonNumber, season.status, season.episodeFileCount, season.totalEpisodes])).toEqual([
      [1, 'available', 10, 10],
      [2, 'partial', 4, 10],
      [3, 'unknown', 0, 10],
    ])
    expect(availability.status).toBe('partial')
  })

  it('une série dont toutes les saisons sont complètes est disponible, les spéciaux mis à part', () => {
    const index = buildSorraaIndex([series(1399, { 0: [0, 2], 1: [8, 8], 2: [8, 8] })], [])

    expect(sorraaAvailabilityIn(index, 'tv', 1399).status).toBe('available')
  })

  it('une saison en cours de diffusion reste partielle jusqu’au dernier épisode', () => {
    const index = buildSorraaIndex([series(1399, { 1: [8, 8], 2: [5, 8] })], [])

    expect(sorraaAvailabilityIn(index, 'tv', 1399).seasons.find((season) => season.seasonNumber === 2)?.status).toBe('partial')
  })

  it('une demande de saison dit où en est la saison que sorraa n’a pas encore', () => {
    const index = buildSorraaIndex([series(1399, { 1: [8, 8], 2: [0, 8], 3: [0, 8] })], [request(1399, 'series', 'processing', { 2: 'processing', 3: 'pending' })])

    const statuses = sorraaAvailabilityIn(index, 'tv', 1399).seasons.map((season) => season.status)

    expect(statuses).toEqual(['available', 'processing', 'pending'])
  })

  it('une série seulement suivie dans la bibliothèque, sans demande, n’est pas « demandée »', () => {
    const index = buildSorraaIndex([series(1399, { 1: [0, 8] })], [])

    expect(sorraaAvailabilityIn(index, 'tv', 1399).status).toBe('unknown')
  })

  it('une demande pour une série pas encore dans la bibliothèque la montre demandée', () => {
    const index = buildSorraaIndex([], [request(1399, 'series', 'pending', { 1: 'pending' })])

    expect(sorraaAvailabilityIn(index, 'tv', 1399).status).toBe('pending')
  })
})
