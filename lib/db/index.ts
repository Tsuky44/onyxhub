import 'server-only'
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { join } from 'node:path'
import { dataDir } from '../paths'
import * as schema from './schema'

export type Db = BetterSQLite3Database<typeof schema>

// En dev, Next recharge les modules à chaque modification : sans ce cache
// global, chaque rechargement ouvrirait une connexion de plus sur le fichier.
const globalForDb = globalThis as unknown as { onyxhubDb?: Db }

/** La base, ouverte et migrée au premier appel. */
export function getDb(): Db {
  if (globalForDb.onyxhubDb) return globalForDb.onyxhubDb

  const sqlite = new Database(join(dataDir(), 'onyxhub.db'))
  // WAL : les lectures des pages ne bloquent pas l'écriture d'un réglage ou
  // d'un webhook, comme dans Onyx.
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('busy_timeout = 5000')

  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: join(process.cwd(), 'lib', 'db', 'migrations') })
  globalForDb.onyxhubDb = db
  return db
}
