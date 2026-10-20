import { describe, expect, it } from 'vitest'
import { isImport, parseRadarrEvent, parseSonarrEvent } from './webhook-payload'

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

  it('lit le fichier importé par Radarr, chemin complet ou dossier + chemin relatif', () => {
    const movie = { tmdbId: 603, folderPath: '/films/Matrix (1999)/' }
    expect(parseRadarrEvent({ eventType: 'Download', movie, movieFile: { path: '/films/Matrix (1999)/Matrix.mkv' } })?.paths).toEqual([
      '/films/Matrix (1999)/Matrix.mkv',
    ])
    expect(parseRadarrEvent({ eventType: 'Download', movie, movieFile: { relativePath: 'Matrix.mkv' } })?.paths).toEqual(['/films/Matrix (1999)/Matrix.mkv'])
    expect(parseRadarrEvent({ eventType: 'Grab', movie })?.paths).toEqual(['/films/Matrix (1999)/'])
  })

  it('lit tous les épisodes importés d’un lot Sonarr, sans doublon', () => {
    const event = parseSonarrEvent({
      eventType: 'Download',
      series: { tvdbId: 121361, path: '/series/GoT' },
      episodeFiles: [{ path: '/series/GoT/S01/e1.mkv' }, { relativePath: 'S01/e2.mkv' }],
      episodeFile: { path: '/series/GoT/S01/e1.mkv' },
    })
    expect(event?.paths).toEqual(['/series/GoT/S01/e1.mkv', '/series/GoT/S01/e2.mkv'])
    expect(event && isImport(event)).toBe(true)
  })

  it('ignore un test de connexion, qui ne porte aucun média', () => {
    expect(parseRadarrEvent({ eventType: 'Test' })).toBeNull()
    expect(parseSonarrEvent({ eventType: 'Test' })).toBeNull()
  })
})
