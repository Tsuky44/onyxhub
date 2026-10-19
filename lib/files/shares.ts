import 'server-only'
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { desc, eq, sql } from 'drizzle-orm'
import { getDb } from '../db'
import { fileShares } from '../db/schema'
import { baseName, joinPath, splitPath } from '../services/smb/paths'

/**
 * Les liens de partage publics. Un lien donne accès à un seul fichier ou
 * dossier, sans compte : son jeton est aléatoire (144 bits), son mot de
 * passe éventuel haché, et les essais de mot de passe sont limités.
 */
const hash = promisify(scrypt) as (password: string, salt: Buffer, length: number) => Promise<Buffer>
const KEY_LENGTH = 32
const DAY_MS = 86_400_000

export const SHARE_DURATIONS = [
  { id: '1', label: '24 heures', days: 1 },
  { id: '7', label: '7 jours', days: 7 },
  { id: '30', label: '30 jours', days: 30 },
  { id: '0', label: 'Sans limite', days: null },
] as const

export type ShareDuration = (typeof SHARE_DURATIONS)[number]['id']

export interface ShareView {
  id: number
  token: string
  path: string
  name: string
  kind: 'file' | 'folder'
  hasPassword: boolean
  expiresAt: number | null
  expired: boolean
  createdBy: string
  createdAt: number
  downloads: number
  lastDownloadAt: number | null
}

type ShareRow = typeof fileShares.$inferSelect

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  return `${salt.toString('hex')}:${(await hash(password, salt, KEY_LENGTH)).toString('hex')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, keyHex] = stored.split(':')
  if (!saltHex || !keyHex) return false
  const expected = Buffer.from(keyHex, 'hex')
  const actual = await hash(password, Buffer.from(saltHex, 'hex'), expected.length)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function isExpired(share: { expiresAt: Date | null }, now = Date.now()): boolean {
  return share.expiresAt !== null && share.expiresAt.getTime() <= now
}

function toView(row: ShareRow, now: number): ShareView {
  return {
    id: row.id,
    token: row.token,
    path: row.path,
    name: baseName(row.path),
    kind: row.kind,
    hasPassword: row.passwordHash !== null,
    expiresAt: row.expiresAt?.getTime() ?? null,
    expired: isExpired(row, now),
    createdBy: row.createdBy,
    createdAt: row.createdAt.getTime(),
    downloads: row.downloads,
    lastDownloadAt: row.lastDownloadAt?.getTime() ?? null,
  }
}

export async function createShare(input: {
  path: string
  kind: 'file' | 'folder'
  duration: ShareDuration
  password: string | null
  createdBy: string
}): Promise<ShareView> {
  const path = joinPath(splitPath(input.path))
  const days = SHARE_DURATIONS.find((duration) => duration.id === input.duration)?.days ?? 7
  const now = Date.now()
  const row = getDb()
    .insert(fileShares)
    .values({
      token: randomBytes(18).toString('base64url'),
      path,
      kind: input.kind,
      passwordHash: input.password ? await hashPassword(input.password) : null,
      expiresAt: days === null ? null : new Date(now + days * DAY_MS),
      createdBy: input.createdBy,
      createdAt: new Date(now),
    })
    .returning()
    .get()
  return toView(row, now)
}

export function listShares(now = Date.now()): ShareView[] {
  return getDb()
    .select()
    .from(fileShares)
    .orderBy(desc(fileShares.createdAt))
    .all()
    .map((row) => toView(row, now))
}

export function revokeShare(id: number): void {
  getDb().delete(fileShares).where(eq(fileShares.id, id)).run()
}

/** Les liens d'un élément supprimé ne mèneraient plus nulle part. */
export function revokeSharesUnder(path: string): void {
  const prefix = joinPath(splitPath(path))
  if (!prefix) return
  getDb()
    .delete(fileShares)
    .where(sql`${fileShares.path} = ${prefix} or substr(${fileShares.path}, 1, ${prefix.length + 1}) = ${`${prefix}/`}`)
    .run()
}

export function findShare(token: string): ShareRow | null {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null
  return getDb().select().from(fileShares).where(eq(fileShares.token, token)).get() ?? null
}

export function recordDownload(id: number): void {
  getDb()
    .update(fileShares)
    .set({ downloads: sql`${fileShares.downloads} + 1`, lastDownloadAt: new Date() })
    .where(eq(fileShares.id, id))
    .run()
}

// --- Essais de mot de passe : 5 par lien et par 10 minutes ---

const MAX_FAILURES = 5
const WINDOW_MS = 10 * 60_000
const failures = new Map<string, { count: number; since: number }>()

export function tooManyAttempts(token: string, now = Date.now()): boolean {
  const entry = failures.get(token)
  if (!entry) return false
  if (now - entry.since > WINDOW_MS) {
    failures.delete(token)
    return false
  }
  return entry.count >= MAX_FAILURES
}

export function recordFailure(token: string, now = Date.now()): void {
  const entry = failures.get(token)
  if (!entry || now - entry.since > WINDOW_MS) failures.set(token, { count: 1, since: now })
  else entry.count += 1
  // Borne la mémoire : les plus anciennes entrées partent d'abord.
  if (failures.size > 1_000) failures.delete(failures.keys().next().value!)
}

export function clearFailures(token: string): void {
  failures.delete(token)
}
