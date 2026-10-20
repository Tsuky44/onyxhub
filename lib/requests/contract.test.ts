import { describe, expect, it } from 'vitest'
import {
  availabilityBatchPayload,
  availabilityPayload,
  integrationPingPayload,
  MAX_BATCH_ITEMS,
  parseAvailabilityBatch,
  parseRequestBody,
} from './contract'

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

  it("accepte une page du catalogue d'Onyx en un seul lot", () => {
    expect(parseAvailabilityBatch({ items: [{ tmdbId: 603, mediaType: 'movie' }, { tmdbId: 1399, mediaType: 'tv' }] })).toEqual({
      ok: true,
      items: [
        { tmdbId: 603, mediaType: 'movie' },
        { tmdbId: 1399, mediaType: 'tv' },
      ],
    })
    expect(parseAvailabilityBatch({ items: [] })).toEqual({ ok: true, items: [] })
  })

  it('refuse un lot mal formé ou trop gros pour une page de catalogue', () => {
    expect(parseAvailabilityBatch(null).ok).toBe(false)
    expect(parseAvailabilityBatch({ items: [{ tmdbId: 603, mediaType: 'book' }] }).ok).toBe(false)
    expect(parseAvailabilityBatch({ items: [{ tmdbId: -1, mediaType: 'movie' }] }).ok).toBe(false)
    const tooMany = Array.from({ length: MAX_BATCH_ITEMS + 1 }, (_, id) => ({ tmdbId: id + 1, mediaType: 'movie' }))
    expect(parseAvailabilityBatch({ items: tooMany }).ok).toBe(false)
  })

  it("rend le lot dans l'ordre de la question, chaque média au format de la route unitaire", () => {
    const payload = availabilityBatchPayload([
      { query: { tmdbId: 603, mediaType: 'movie' }, availability: { status: 'available', available: true, seasons: [] } },
      { query: { tmdbId: 1399, mediaType: 'tv' }, availability: { status: 'unknown', available: false, seasons: [] } },
    ])
    expect(payload).toEqual({
      results: [
        { tmdbId: 603, mediaType: 'movie', status: 'available', available: true, seasons: [] },
        { tmdbId: 1399, mediaType: 'tv', status: 'unknown', available: false, seasons: [] },
      ],
    })
  })

  it('se présente comme OnyxHub au test de liaison', () => {
    expect(integrationPingPayload('1.2.3')).toEqual({ status: 'ok', service: 'onyxhub', version: '1.2.3', features: ['availability-batch'] })
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
