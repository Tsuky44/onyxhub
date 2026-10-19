import { describe, expect, it, vi } from 'vitest'
import { TtlCache } from './ttl-cache'

describe('cache borné', () => {
  it('oublie une valeur après sa durée de vie', () => {
    let now = 0
    const cache = new TtlCache<string>(1_000, 10, () => now)
    cache.set('a', 'x')
    now = 999
    expect(cache.get('a')).toBe('x')
    now = 1_000
    expect(cache.get('a')).toBeUndefined()
  })

  it("ne dépasse jamais son plafond et évince la clé la moins récemment lue", () => {
    const cache = new TtlCache<number>(60_000, 2)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.get('a')
    cache.set('c', 3)
    expect(cache.get('b')).toBeUndefined()
    expect(cache.get('a')).toBe(1)
    expect(cache.get('c')).toBe(3)
  })

  it('ne fait qu\'un chargement pour des demandes simultanées', async () => {
    const cache = new TtlCache<number>(60_000, 10)
    const loader = vi.fn(async () => 42)
    const [a, b] = await Promise.all([cache.load('k', loader), cache.load('k', loader)])
    expect([a, b]).toEqual([42, 42])
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it("ne garde pas un échec : l'appel suivant recharge", async () => {
    const cache = new TtlCache<number>(60_000, 10)
    await expect(cache.load('k', async () => Promise.reject(new Error('panne')))).rejects.toThrow('panne')
    expect(await cache.load('k', async () => 7)).toBe(7)
  })
})
