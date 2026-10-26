import { describe, expect, it } from 'vitest'
import type { MediaRequestRow } from '../db/schema'
import { asArrEvent, parseSorraaDownloads, parseSorraaEvents, statusChangesFromSorraa, toDownloadProgress } from './sorraa'

const row = (id: number, seasonNumber: number | null, status: MediaRequestRow['status']): MediaRequestRow =>
  ({ id, mediaType: seasonNumber === null ? 'movie' : 'tv', tmdbId: 1, seasonNumber, status }) as MediaRequestRow

function firstEvent(body: unknown) {
  const [event] = parseSorraaEvents(body)
  if (!event) throw new Error('aucun événement lu')
  return event
}

const batch = {
  events: [
    {
      id: 7,
      event: 'imported',
      media: { id: 3, kind: 'series', tmdbId: 1396, title: 'Breaking Bad' },
      unit: { id: 9, kind: 'episode', season: 2, episode: 4 },
      message: '/tv/Breaking Bad/S02E04.mkv',
      requests: [{ id: 1, state: 'partial', seasons: [{ number: 1, state: 'available' }, { number: 2, state: 'partial' }] }],
    },
    { id: 0, event: 'imported', media: { kind: 'movie', tmdbId: 5 } },
    { id: 8, event: 'grabbed', media: { kind: 'movie' } },
  ],
}

describe('événements de sorraa', () => {
  it('lit les événements d un lot et écarte ceux qui ne disent pas de quel média', () => {
    const events = parseSorraaEvents(batch)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ id: 7, mediaType: 'tv', tmdbId: 1396, season: 2 })
    expect(events[0]?.requests[0]?.seasons).toEqual([{ number: 1, state: 'available' }, { number: 2, state: 'partial' }])
  })

  it('accepte un lot vide, qui prouve la liaison', () => {
    expect(parseSorraaEvents({ events: [] })).toEqual([])
    expect(parseSorraaEvents(null)).toEqual([])
  })

  it('fait suivre à chaque saison demandée l état de cette saison', () => {
    const event = firstEvent(batch)
    const changes = statusChangesFromSorraa([row(1, 1, 'processing'), row(2, 2, 'processing'), row(3, 3, 'pending')], event)
    // La saison 1, « disponible » chez sorraa, reste « en cours » : seul Onyx dit « disponible ».
    expect(Object.fromEntries(changes)).toEqual({ 2: 'partial' })
  })

  it('ne fait pas reculer une demande dont la saison attend', () => {
    const event = firstEvent({
      events: [{ id: 1, event: 'searched', media: { kind: 'movie', tmdbId: 5 }, requests: [{ state: 'pending' }] }],
    })
    expect(statusChangesFromSorraa([row(1, null, 'approved')], event).size).toBe(0)
  })

  it('annonce un import à Onyx avec un chemin complet seulement', () => {
    const event = firstEvent(batch)
    expect(asArrEvent(event)).toMatchObject({ eventType: 'Download', mediaType: 'tv', seasons: [2], paths: ['/tv/Breaking Bad/S02E04.mkv'] })
    expect(asArrEvent({ ...event, message: 'S02E04.mkv' })?.paths).toBeUndefined()
    expect(asArrEvent({ ...event, event: 'grabbed' })).toBeNull()
  })
})

describe('téléchargements de sorraa', () => {
  const report = {
    downloads: [
      { id: 1, media: { kind: 'movie', tmdbId: 603 }, release: 'The.Matrix', state: 'downloading', progress: 0.4237, size: 1000, left: 576, speed: 50, eta: 90 },
      { id: 2, media: { kind: 'series', tmdbId: 1396 }, season: 2, release: 'BB.S02', state: 'paused', progress: 0.1, size: 10, left: 9, speed: 0 },
      { id: 3, media: { kind: 'movie' }, release: 'unknown' },
    ],
  }

  it('lit le rapport et écarte ce qui n a pas de média', () => {
    expect(parseSorraaDownloads(report)).toHaveLength(2)
  })

  it('présente un téléchargement comme la fiche du média l attend', () => {
    const [movie, show] = parseSorraaDownloads(report).map(toDownloadProgress)
    expect(movie).toEqual({ title: 'The.Matrix', seasonNumber: null, progress: 42.4, size: 1000, sizeLeft: 576, speed: 50, eta: 90, stalled: false })
    expect(show).toMatchObject({ seasonNumber: 2, stalled: true, eta: null })
  })
})
