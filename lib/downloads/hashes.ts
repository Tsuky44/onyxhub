const HASH = /^[a-f0-9]{40}$|^[a-f0-9]{64}$/i

/** Un hash de torrent (v1 en SHA-1, v2 en SHA-256). */
export function isTorrentHash(value: unknown): value is string {
  return typeof value === 'string' && HASH.test(value)
}

/**
 * Une liste de hashes valide et non vide, en minuscules, ou `null`. Le client
 * qBit traduit une liste vide en `all` : sans ce garde-fou, une sélection
 * perdue suspendrait (ou supprimerait) tous les torrents.
 */
export function parseHashes(input: unknown): string[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > 5_000) return null
  if (!input.every(isTorrentHash)) return null
  return [...new Set(input.map((hash) => hash.toLowerCase()))]
}
