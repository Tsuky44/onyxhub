import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { REQUEST_STATUSES } from '../requests/status'

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

/**
 * Une demande de média. Une série a une ligne **par saison**, comme dans
 * MediaHub : chaque saison avance, se supprime et se compte à part. Les
 * saisons demandées d'un même geste partagent un `batchId`, et la liste les
 * regroupe sur une seule ligne (MediaHub devinait le lot avec une fenêtre de
 * 60 s).
 *
 * Un média (ou une saison) n'a qu'une demande, quel que soit le demandeur :
 * la deuxième personne qui le demande apprend qu'il l'est déjà.
 */
export const mediaRequests = sqliteTable(
  'media_requests',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    mediaType: text('media_type', { enum: ['movie', 'tv'] }).notNull(),
    tmdbId: integer('tmdb_id').notNull(),
    /** `null` pour un film. */
    seasonNumber: integer('season_number'),
    /** L'identifiant Sonarr d'une série : les webhooks Sonarr ne donnent que lui. */
    tvdbId: integer('tvdb_id'),
    title: text('title').notNull(),
    posterPath: text('poster_path'),
    status: text('status', { enum: REQUEST_STATUSES }).notNull(),
    /** Le nom du compte Onyx, seul identifiant que le serveur Onyx transmet (`X-Player-Username`). */
    requester: text('requester').notNull(),
    batchId: text('batch_id').notNull(),
    requestedAt: integer('requested_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('media_requests_media_idx').on(table.mediaType, table.tmdbId),
    index('media_requests_tvdb_idx').on(table.tvdbId),
    index('media_requests_status_idx').on(table.status),
    index('media_requests_requester_idx').on(table.requester),
    index('media_requests_batch_idx').on(table.batchId),
    index('media_requests_requested_idx').on(table.requestedAt),
  ],
)

/** « À regarder plus tard », par compte Onyx. */
export const watchLater = sqliteTable(
  'watch_later',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id').notNull(),
    mediaType: text('media_type', { enum: ['movie', 'tv'] }).notNull(),
    tmdbId: integer('tmdb_id').notNull(),
    title: text('title').notNull(),
    posterPath: text('poster_path'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [uniqueIndex('watch_later_user_media_unique').on(table.userId, table.mediaType, table.tmdbId)],
)

/**
 * Abonnements au calendrier, par compte Onyx : les sorties d'un média qui
 * n'est pas (ou pas encore) demandé apparaissent dans le calendrier du compte.
 * MediaHub figeait une date de sortie à l'abonnement ; ici les dates sont
 * relues dans TMDB, un report se voit.
 */
export const calendarSubscriptions = sqliteTable(
  'calendar_subscriptions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id').notNull(),
    mediaType: text('media_type', { enum: ['movie', 'tv'] }).notNull(),
    tmdbId: integer('tmdb_id').notNull(),
    title: text('title').notNull(),
    posterPath: text('poster_path'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [uniqueIndex('calendar_subscriptions_user_media_unique').on(table.userId, table.mediaType, table.tmdbId)],
)

export type MediaRequestRow = typeof mediaRequests.$inferSelect
