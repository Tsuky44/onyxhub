import { describe, expect, it } from 'vitest'
import { findService } from './registry'
import { serviceStatus } from './status'

const qbit = findService('qbittorrent')!
const set = (...keys: string[]) => (key: string) => keys.includes(key)

describe("état d'un service dans Réglages", () => {
  it("dit configuré qBit sans identifiants : il peut dispenser ce réseau d'authentification", () => {
    expect(serviceStatus(qbit, set('qbittorrent_url'))).toBe('configured')
  })

  it('dit vide un service sans aucune valeur', () => {
    expect(serviceStatus(qbit, set())).toBe('empty')
  })

  it('dit partiel un service avec seulement un champ facultatif', () => {
    expect(serviceStatus(qbit, set('qbittorrent_username'))).toBe('partial')
  })

  it('dit partiel Radarr avec une URL mais sans clé', () => {
    expect(serviceStatus(findService('radarr')!, set('radarr_url'))).toBe('partial')
  })
})
