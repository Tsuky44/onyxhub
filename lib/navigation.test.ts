import { describe, expect, it } from 'vitest'
import { isActive, navItemsFor } from './navigation'

describe('navigation', () => {
  it('cache les onglets admin à un simple utilisateur', () => {
    const hrefs = navItemsFor(false).map((item) => item.href)
    expect(hrefs).toEqual(['/', '/demandes', '/calendrier'])
  })

  it('montre tous les onglets à un admin', () => {
    expect(navItemsFor(true).map((item) => item.href)).toContain('/telechargements')
    expect(navItemsFor(true).map((item) => item.href)).toContain('/statistiques')
    expect(navItemsFor(true).map((item) => item.href)).toContain('/reglages')
  })

  it("n'allume l'accueil que sur la racine", () => {
    expect(isActive('/', '/')).toBe(true)
    expect(isActive('/', '/demandes')).toBe(false)
  })

  it('allume un onglet sur ses sous-pages, pas sur un préfixe voisin', () => {
    expect(isActive('/demandes', '/demandes/movie/42')).toBe(true)
    expect(isActive('/demandes', '/demandesx')).toBe(false)
  })
})
