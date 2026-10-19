/**
 * Cache en mémoire borné, avec durée de vie, comme `ttlcache` d'Onyx
 * (ADR-0050 d'Onyx) : toujours un plafond, pour qu'un catalogue parcouru
 * longtemps ne fasse pas grossir le process sans fin.
 *
 * `load` déduplique les chargements en vol : dix cartes qui demandent la même
 * fiche TMDB au même moment ne font qu'un seul appel.
 */
export class TtlCache<V> {
  private readonly entries = new Map<string, { value: V; expiresAt: number }>()
  private readonly inFlight = new Map<string, Promise<V>>()

  constructor(
    private readonly ttlMs: number,
    private readonly max: number,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: string): V | undefined {
    const entry = this.entries.get(key)
    if (!entry) return undefined
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key)
      return undefined
    }
    // Réinsérer place la clé en fin d'ordre : l'éviction retire alors la moins récemment lue.
    this.entries.delete(key)
    this.entries.set(key, entry)
    return entry.value
  }

  set(key: string, value: V, ttlMs = this.ttlMs): void {
    this.entries.delete(key)
    while (this.entries.size >= this.max) {
      const oldest = this.entries.keys().next().value
      if (oldest === undefined) break
      this.entries.delete(oldest)
    }
    this.entries.set(key, { value, expiresAt: this.now() + ttlMs })
  }

  delete(key: string): void {
    this.entries.delete(key)
  }

  clear(): void {
    this.entries.clear()
  }

  /** La valeur en cache, ou celle que `loader` produit. Un échec n'est pas mis en cache. */
  async load(key: string, loader: () => Promise<V>, ttlMs = this.ttlMs): Promise<V> {
    const hit = this.get(key)
    if (hit !== undefined) return hit
    const pending = this.inFlight.get(key)
    if (pending) return pending
    const promise = loader()
      .then((value) => {
        this.set(key, value, ttlMs)
        return value
      })
      .finally(() => this.inFlight.delete(key))
    this.inFlight.set(key, promise)
    return promise
  }
}
