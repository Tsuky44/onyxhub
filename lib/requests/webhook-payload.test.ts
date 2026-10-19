import { describe, expect, it } from 'vitest'
import { parseRadarrEvent, parseSonarrEvent } from './webhook-payload'

describe('webhooks Radarr/Sonarr', () => {
  it("lit le film d'un événement Radarr", () => {
    expect(parseRadarrEvent({ eventType: 'Download', movie: { id: 1, tmdbId: 603, title: 'Matrix' } })).toEqual({
      mediaType: 'movie',
      eventType: 'Download',
      tmdbId: 603,
    })
  })

  it("lit la série et les saisons d'un événement Sonarr", () => {
    const event = parseSonarrEvent({
      eventType: 'Grab',
      series: { tvdbId: 121361, title: 'GoT' },
      episodes: [
        { seasonNumber: 2, episodeNumber: 1 },
        { seasonNumber: 2, episodeNumber: 2 },
      ],
    })
    expect(event).toEqual({ mediaType: 'tv', eventType: 'Grab', tvdbId: 121361, tmdbId: undefined, seasons: [2] })
  })

  it('ignore un test de connexion, qui ne porte aucun média', () => {
    expect(parseRadarrEvent({ eventType: 'Test' })).toBeNull()
    expect(parseSonarrEvent({ eventType: 'Test' })).toBeNull()
  })
})
