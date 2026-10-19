import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * Réglages des services branchés (URL, clés…). Les secrets sont chiffrés par
 * `lib/crypto.ts` avant d'arriver ici : la colonne ne contient jamais une clé
 * en clair, même dans une sauvegarde de la base.
 */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  encrypted: integer('encrypted', { mode: 'boolean' }).notNull().default(false),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})
