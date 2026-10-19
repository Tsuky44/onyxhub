import { describe, expect, it } from 'vitest'
import { availabilityPayload, parseRequestBody } from './contract'

/**
 * Le contrat lu par le serveur Onyx (`server/handlers/mediahub.go`) : ces
 * tests épinglent les formats de MediaHub. S'ils doivent changer, Onyx
 * change dans le même mouvement (ADR-0002).
 */
describe('contrat Onyx', () => {
  it("accepte la demande d'Onyx avec une saison seule ou une liste", () => {
    expect(parseRequestBody({ tmdbId: 1399, mediaType: 'tv', seasons: 2 })).toMatchObject({ ok: true, input: { seasons: [2] } })
    expect(parseRequestBody({ tmdbId: '1399', mediaType: 'tv', seasons: [1, 2], title: 'GoT', posterPath: '/p.jpg' })).toEqual({
      ok: true,
      input: { tmdbId: 1399, mediaType: 'tv', seasons: [1, 2], title: 'GoT', posterPath: '/p.jpg' },
    })
  })

  it("ignore les saisons d'un film et refuse un type inconnu", () => {
    expect(parseRequestBody({ tmdbId: 603, mediaType: 'movie', seasons: [1] })).toMatchObject({ ok: true, input: { seasons: undefined } })
    expect(parseRequestBody({ tmdbId: 603, mediaType: 'book' }).ok).toBe(false)
    expect(parseRequestBody({ mediaType: 'movie' }).ok).toBe(false)
  })

  it('répond la disponibilité au format de MediaHub', () => {
    const payload = availabilityPayload({
      status: 'partial',
      available: true,
      seasons: [{ seasonNumber: 1, status: 'available', available: true, totalEpisodes: 10, episodeFileCount: 10 }],
    })
    expect(payload).toEqual({
      status: 'partial',
      available: true,
      seasons: [{ seasonNumber: 1, status: 'available', available: true, totalEpisodes: 10 }],
    })
  })
})
