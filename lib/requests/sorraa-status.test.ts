import { describe, expect, it } from 'vitest'
import { presentedAvailability, reportedState, statusFromSorraaAndOnyx } from './sorraa-status'

describe('statut d une demande : sorraa avant la dispo, Onyx pour la dispo', () => {
  it('suit sorraa tant que le titre n est pas dans Onyx', () => {
    expect(statusFromSorraaAndOnyx('pending', true, 'processing', false)).toBe('processing')
    expect(statusFromSorraaAndOnyx('approved', false, 'partial', false)).toBe('partial')
  })

  it('ne dit pas disponible sur la seule parole de sorraa : l import n est pas fini pour Onyx', () => {
    expect(statusFromSorraaAndOnyx('processing', true, 'available', false)).toBe('processing')
    expect(statusFromSorraaAndOnyx('processing', true, 'available', null)).toBe('processing')
  })

  it('est disponible quand Onyx a le titre, même si sorraa ne sait rien', () => {
    expect(statusFromSorraaAndOnyx('pending', true, undefined, true)).toBe('available')
    expect(statusFromSorraaAndOnyx('pending', true, 'processing', true)).toBe('available')
  })

  it('garde une saison en cours d une série déjà dans Onyx', () => {
    expect(statusFromSorraaAndOnyx('approved', false, 'processing', true)).toBe('processing')
    expect(statusFromSorraaAndOnyx('processing', false, 'available', true)).toBe('available')
  })

  it('ne change rien sans information', () => {
    expect(statusFromSorraaAndOnyx('pending', true, undefined, null)).toBe('pending')
  })
})

describe('statut affiché sur la fiche', () => {
  const unknown = { status: 'unknown' as const, available: false, seasons: [] }
  const movie = (state: 'pending' | 'processing' | 'available') => [{ id: 1, mediaId: 1, kind: 'movie' as const, tmdbId: 5, state }]

  it('montre « demandé » quand sorraa a la demande que Radarr/Sonarr ne voient pas, pour ne pas rouvrir le bouton', () => {
    expect(presentedAvailability(unknown, 'movie', movie('pending'), false).status).toBe('pending')
  })

  it('attend Onyx pour dire disponible', () => {
    expect(presentedAvailability(unknown, 'movie', movie('available'), false).status).toBe('processing')
    expect(presentedAvailability(unknown, 'movie', movie('available'), true).status).toBe('available')
  })

  it('ne change rien sans demande chez sorraa, sauf la présence dans Onyx', () => {
    expect(presentedAvailability(unknown, 'movie', null, false)).toBe(unknown)
    expect(presentedAvailability(unknown, 'movie', [], true).status).toBe('available')
  })

  it('un titre que sorraa a téléchargé sans demande n’est disponible que si Onyx le voit', () => {
    const downloaded = { status: 'available' as const, available: true, seasons: [] }
    const partial = { status: 'partial' as const, available: true, seasons: [] }

    expect(presentedAvailability(downloaded, 'movie', [], false).status).toBe('processing')
    expect(presentedAvailability(downloaded, 'movie', [], true).status).toBe('available')
    expect(presentedAvailability(partial, 'tv', [], false).status).toBe('processing')
    expect(presentedAvailability(partial, 'tv', [], true).status).toBe('partial')
  })

  it('sans sorraa, Radarr et Sonarr gardent leur mot', () => {
    const downloaded = { status: 'available' as const, available: true, seasons: [] }

    expect(presentedAvailability(downloaded, 'movie', null, false)).toBe(downloaded)
  })

  it('une saison sans fichier ni demande ne devient pas disponible parce que la série est dans Onyx', () => {
    const season = (seasonNumber: number, status: 'unknown' | 'available', episodeFileCount: number) => ({ seasonNumber, status, available: episodeFileCount > 0, totalEpisodes: 8, episodeFileCount })
    const arr = { status: 'partial' as const, available: true, seasons: [season(1, 'unknown', 0), season(2, 'available', 8)] }

    for (const requests of [null, []]) {
      const result = presentedAvailability(arr, 'tv', requests, true)
      expect(result.seasons.map((entry) => [entry.seasonNumber, entry.status])).toEqual([[1, 'unknown'], [2, 'available']])
    }
  })

  it('une saison demandée à sorraa reste en attente tant que rien n est téléchargé', () => {
    const arr = { status: 'unknown' as const, available: false, seasons: [{ seasonNumber: 1, status: 'unknown' as const, available: false, totalEpisodes: 8, episodeFileCount: 0 }] }
    const series = [{ id: 1, mediaId: 1, kind: 'series' as const, tmdbId: 5, state: 'pending' as const, seasons: [{ number: 1, state: 'pending' as const }] }]

    expect(presentedAvailability(arr, 'tv', series, true).seasons[0]?.status).toBe('pending')
  })

  it('suit les saisons de sorraa', () => {
    const series = [{ id: 1, mediaId: 1, kind: 'series' as const, tmdbId: 5, state: 'pending' as const, seasons: [{ number: 2, state: 'pending' as const }] }]
    const result = presentedAvailability(unknown, 'tv', series, false)
    expect(result.seasons.map((season) => [season.seasonNumber, season.status])).toEqual([[2, 'pending']])
  })
})

describe('état rapporté par les demandes de sorraa', () => {
  const requests = [
    { id: 1, mediaId: 1, kind: 'series' as const, tmdbId: 5, state: 'processing' as const, seasons: [{ number: 1, state: 'available' as const }, { number: 2, state: 'processing' as const }] },
    { id: 2, mediaId: 1, kind: 'series' as const, tmdbId: 5, state: 'pending' as const, seasons: [{ number: 2, state: 'pending' as const }] },
  ]

  it('prend le plus avancé des demandeurs pour une saison', () => {
    expect(reportedState({ seasonNumber: 2 }, requests)).toBe('processing')
    expect(reportedState({ seasonNumber: 1 }, requests)).toBe('available')
  })

  it('ignore une saison que sorraa ne couvre pas', () => {
    expect(reportedState({ seasonNumber: 9 }, requests)).toBeUndefined()
  })
})
