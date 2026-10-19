import 'server-only'
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

/**
 * Le dossier des données persistantes : base SQLite, clé de chiffrement,
 * cache des affiches. Monté en volume dans Docker (phase 8).
 */
export function dataDir(): string {
  // `turbopackIgnore` : chemin connu seulement à l'exécution. Sans ce
  // commentaire, le build standalone embarque tout le projet en le traçant.
  const dir = resolve(/* turbopackIgnore: true */ process.env.ONYXHUB_DATA_DIR?.trim() || join(process.cwd(), 'data'))
  mkdirSync(dir, { recursive: true })
  return dir
}
