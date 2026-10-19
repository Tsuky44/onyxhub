import { describe, expect, it } from 'vitest'
import type { RadarrMovie, SonarrSeries } from '../services/arr/types'
import { movieAvailability, seasonAvailability, seriesAvailability } from './availability'

const movie = (fields: Partial<RadarrMovie>): RadarrMovie => ({ id: 1, tmdbId: 603, title: 'Matrix', year: 1999, monitored: true, hasFile: false, ...fields })

const season = (seasonNumber: number, monitored: boolean, files: number, total: number) => ({
  seasonNumber,
  monitored,
  statistics: { episodeFileCount: files, episodeCount: total, totalEpisodeCount: total },
})
const series = (seasons: SonarrSeries['seasons']): SonarrSeries => ({ id: 7, tvdbId: 1, title: 'Série', monitored: true, seasons })

describe("disponibilité d'un film", () => {
  it('dit « disponible » dès que le fichier est là', () => {
    expect(movieAvailability(movie({ hasFile: true }), true).status).toBe('available')
  })

  it('dit « en cours » quand il est dans la file, même avant le premier octet', () => {
    expect(movieAvailability(movie({}), true).status).toBe('processing')
  })

  it("dit « demandé » quand Radarr le surveille sans l'avoir", () => {
    expect(movieAvailability(movie({}), false).status).toBe('pending')
  })

  it("ne dit rien d'un film absent ou ignoré", () => {
    expect(movieAvailability(undefined, false).status).toBe('unknown')
    expect(movieAvailability(movie({ monitored: false }), false).status).toBe('unknown')
  })
})

describe("disponibilité d'une série", () => {
  it('est disponible quand toutes les saisons diffusées sont complètes, épisodes spéciaux ignorés', () => {
    const result = seriesAvailability(series([season(0, false, 0, 3), season(1, true, 10, 10), season(2, true, 8, 8)]), new Set())
    expect(result.status).toBe('available')
  })

  it("reste partielle tant qu'une saison en diffusion n'a pas tous ses épisodes", () => {
    const result = seriesAvailability(series([season(1, true, 10, 10), season(2, true, 3, 10)]), new Set())
    expect(result.status).toBe('partial')
    expect(seasonAvailability(result, 2)).toBe('partial')
  })

  it('passe une saison « en cours » quand elle est dans la file', () => {
    const result = seriesAvailability(series([season(1, true, 0, 10)]), new Set([1]))
    expect(result.status).toBe('processing')
    expect(seasonAvailability(result, 1)).toBe('processing')
  })

  it("ne dit rien d'une série dont aucune saison n'est suivie ni présente", () => {
    expect(seriesAvailability(series([season(1, false, 0, 10)]), new Set()).status).toBe('unknown')
  })

  it('renvoie « inconnue » pour une saison que Sonarr ne connaît pas', () => {
    expect(seasonAvailability(seriesAvailability(series([season(1, true, 0, 10)]), new Set()), 5)).toBe('unknown')
  })
})
