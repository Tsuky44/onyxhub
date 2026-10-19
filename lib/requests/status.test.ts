import { describe, expect, it } from 'vitest'
import { furthestStatus, requestStatusFrom } from './status'

describe("statut d'une demande", () => {
  it('avance avec la disponibilité', () => {
    expect(requestStatusFrom('approved', 'processing')).toBe('processing')
    expect(requestStatusFrom('processing', 'available')).toBe('available')
  })

  it('ne recule pas parce que Radarr/Sonarr dit seulement « demandé »', () => {
    expect(requestStatusFrom('partial', 'pending')).toBe('partial')
    expect(requestStatusFrom('pending', 'pending')).toBe('pending')
  })

  it('revient à « approuvée » quand un téléchargement quitte la file sans fichier', () => {
    expect(requestStatusFrom('processing', 'pending')).toBe('approved')
  })

  it('garde son statut quand le média a disparu de Radarr/Sonarr', () => {
    expect(requestStatusFrom('processing', 'unknown')).toBe('processing')
  })

  it("montre le statut le plus avancé d'un lot de saisons", () => {
    expect(furthestStatus(['approved', 'available', 'processing'])).toBe('available')
  })
})
