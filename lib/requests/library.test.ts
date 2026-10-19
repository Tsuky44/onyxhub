import { describe, expect, it } from 'vitest'
import type { QueueItem, SonarrSeries } from '../services/arr/types'
import type { Torrent } from '../services/qbittorrent/types'
import { downloadsIn } from './downloads'
import { availabilityIn, buildIndex } from './library'

const flags = { radarr: true, sonarr: true }
const queue = (fields: Partial<QueueItem>): QueueItem => ({ id: 1, title: 'Release', status: 'downloading', size: 100, sizeleft: 50, ...fields })
const show: SonarrSeries = { id: 40, tvdbId: 121361, title: 'GoT', monitored: true, seasons: [{ seasonNumber: 1, monitored: true }] }

describe('index de bibliothèque', () => {
  it("retrouve une série Sonarr v3 sans identifiant TMDB par son identifiant TVDB", () => {
    const index = buildIndex([], [show], [], [], flags)
    expect(availabilityIn(index, 'tv', 1399).status).toBe('unknown')
    expect(availabilityIn(index, 'tv', 1399, 121361).status).toBe('pending')
  })

  it('ignore les téléchargements déjà importés ou en échec', () => {
    const index = buildIndex([{ id: 5, tmdbId: 603, title: 'Matrix', year: 1999, monitored: true, hasFile: false }], [], [queue({ movieId: 5, trackedDownloadState: 'imported' })], [], flags)
    expect(availabilityIn(index, 'movie', 603).status).toBe('pending')
  })
})

describe('progression sur la fiche', () => {
  it("lit l'avancement dans qBittorrent et ne compte un pack de saison qu'une fois", () => {
    const tv = { ...show, tmdbId: 1399 }
    const pack = { seriesId: 40, downloadId: 'ABCDEF', episode: { id: 1, seriesId: 40, seasonNumber: 1, episodeNumber: 1, hasFile: false, monitored: true } }
    const index = buildIndex([], [tv], [], [queue({ id: 1, ...pack }), queue({ id: 2, ...pack })], flags)
    const torrents = { abcdef: { name: 'GoT.S01', progress: 0.42, size: 1000, downloaded: 420, dlspeed: 2048, eta: 60, state: 'downloading' } as Torrent }
    expect(downloadsIn(index, torrents, 'tv', 1399)).toEqual([
      { title: 'GoT.S01', seasonNumber: 1, progress: 42, size: 1000, sizeLeft: 580, speed: 2048, eta: 60, stalled: false },
    ])
  })
})
