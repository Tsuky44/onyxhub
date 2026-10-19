import { describe, expect, it } from 'vitest'
import { safeNextPath } from './next-path'

describe('retour après connexion', () => {
  it('garde un chemin interne avec sa requête', () => {
    expect(safeNextPath('/demandes?type=tv')).toBe('/demandes?type=tv')
  })

  it.each(['//evil.tld', 'https://evil.tld', '/\\evil.tld', 'demandes', '', undefined, 42])(
    "refuse ce qui sortirait du site (%s)",
    (raw) => {
      expect(safeNextPath(raw)).toBe('/')
    },
  )

  it('ne renvoie pas vers la page de connexion elle-même', () => {
    expect(safeNextPath('/connexion?suite=/x')).toBe('/')
  })
})
