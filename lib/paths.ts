import 'server-only'
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

/**
 * Le dossier des données persistantes : base SQLite et clé de chiffrement.
 * `ONYXHUB_DATA_DIR` le déplace (vérifications sur une base jetable, par exemple).
 */
export function dataDir(): string {
  // `turbopackIgnore` : chemin connu seulement à l'exécution. Sans ce
  // commentaire, le traçage des fichiers du build embarque tout le projet.
  const dir = resolve(/* turbopackIgnore: true */ process.env.ONYXHUB_DATA_DIR?.trim() || join(process.cwd(), 'data'))
  mkdirSync(dir, { recursive: true })
  return dir
}
