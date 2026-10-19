import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Une base SQLite neuve dans un dossier temporaire, pour les tests qui
 * écrivent. À appeler avant le premier `getDb()` (au chargement du fichier de
 * test) : la base est ouverte paresseusement et gardée sur `globalThis`.
 */
export function createTempDataDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'onyxhub-test-'))
  process.env.ONYXHUB_DATA_DIR = dir
  delete process.env.ONYXHUB_SECRET
  delete (globalThis as { onyxhubDb?: unknown }).onyxhubDb
  return dir
}
