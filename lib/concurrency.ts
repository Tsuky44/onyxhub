/** Exécute `task` sur chaque élément, `limit` à la fois : un import de 500 séries ne lance pas 500 appels TMDB d'un coup. */
export async function eachLimited<T>(items: readonly T[], limit: number, task: (item: T) => Promise<void>): Promise<void> {
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await task(items[next++]!)
  })
  await Promise.all(workers)
}
