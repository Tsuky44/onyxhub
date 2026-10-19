import 'server-only'
import SMB2 from '@marsaud/smb2'
import archiver from 'archiver'
import type { Readable } from 'node:stream'
import { NotConfiguredError, ServiceError } from '../../http'
import { getSetting } from '../../settings/store'
import { InvalidPathError, joinPath, smbPath, splitPath } from './paths'

const SERVICE = 'SMB'
/** Un gros dossier peut mettre plusieurs dizaines de secondes à se lister. */
const OPERATION_TIMEOUT_MS = 60_000
const TEST_TIMEOUT_MS = 10_000
/** Corbeilles et dossiers système, jamais utiles dans l'explorateur. */
const HIDDEN = new Set(['system volume information', '$recycle.bin', '.recycle', '@eadir'])

export interface SmbConfig {
  host: string
  share: string
  username: string
  password: string
  rootPath: string
}

export interface FileEntry {
  name: string
  /** Relatif au dossier racine, avec des `/`. */
  path: string
  kind: 'file' | 'folder'
  size: number
  /** Millisecondes depuis l'époque, ou 0 si inconnu. */
  modifiedAt: number
}

export interface Smb {
  list(path: string): Promise<FileEntry[]>
  stat(path: string): Promise<Pick<FileEntry, 'kind' | 'size' | 'modifiedAt'>>
  readStream(path: string): Promise<Readable>
  /** Le dossier entier en ZIP, construit au fil de l'envoi (rien n'est écrit sur disque). */
  zipStream(path: string): Readable
  remove(path: string): Promise<void>
}

type SmbError = Error & { code?: string }

const MESSAGES: Record<string, string> = {
  STATUS_LOGON_FAILURE: 'Identifiants SMB refusés.',
  STATUS_BAD_NETWORK_NAME: 'Partage SMB introuvable.',
  STATUS_ACCESS_DENIED: 'Accès refusé par le serveur SMB (droits du compte, ou fichier ouvert ailleurs).',
  STATUS_CANNOT_DELETE: 'Le serveur SMB refuse de supprimer cet élément (lecture seule ou ouvert ailleurs).',
  STATUS_OBJECT_NAME_NOT_FOUND: 'Fichier ou dossier introuvable.',
  STATUS_OBJECT_PATH_NOT_FOUND: 'Dossier introuvable.',
  ECONNREFUSED: 'Le serveur SMB refuse la connexion (SMB activé ?).',
  EHOSTUNREACH: 'Hôte SMB injoignable.',
  ETIMEDOUT: 'Le serveur SMB ne répond pas.',
}

/** Une erreur de la bibliothèque SMB en message lisible, sans détail de connexion. */
export function smbError(error: unknown): ServiceError {
  if (error instanceof ServiceError) return error
  if (error instanceof InvalidPathError) return new ServiceError(SERVICE, error.message, { status: 400 })
  const code = (error as SmbError | null)?.code
  return new ServiceError(SERVICE, (code && MESSAGES[code]) ?? 'Le serveur SMB a renvoyé une erreur.', { cause: error })
}

/**
 * Le dossier racine de Réglages, débarrassé d'un éventuel `\\hôte\partage`
 * collé devant (on le saisit souvent ainsi depuis l'explorateur Windows).
 */
export function rootSegments(config: Pick<SmbConfig, 'host' | 'share' | 'rootPath'>): string[] {
  let segments = splitPath(config.rootPath)
  if (/^[\\/]{2}/.test(config.rootPath)) {
    if (segments[0]?.toLowerCase() === config.host.toLowerCase()) segments = segments.slice(1)
    if (segments[0]?.toLowerCase() === config.share.toLowerCase()) segments = segments.slice(1)
  }
  return segments
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ServiceError(SERVICE, 'Le serveur SMB ne répond pas à temps.')), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

function promisify<T>(run: (callback: (error: SmbError | null, value: T) => void) => void): Promise<T> {
  return new Promise<T>((resolve, reject) => run((error, value) => (error ? reject(error) : resolve(value))))
}

const isGone = (error: unknown) => {
  const code = (error as SmbError | null)?.code
  return code === 'STATUS_OBJECT_NAME_NOT_FOUND' || code === 'STATUS_OBJECT_PATH_NOT_FOUND'
}

const toMillis = (value: Date | number | undefined) => (value instanceof Date ? value.getTime() : typeof value === 'number' ? value : 0)

function newClient(config: SmbConfig): SMB2 {
  return new SMB2({
    share: `\\\\${config.host}\\${config.share}`,
    domain: '',
    username: config.username,
    password: config.password,
    autoCloseTimeout: 0,
    packetConcurrency: 8,
  })
}

/**
 * Le client SMB. La connexion est gardée entre les requêtes (MediaHub en
 * rouvrait une, négociation comprise, à chaque dossier) et rouverte une fois
 * après une coupure.
 */
export function createSmb(config: SmbConfig): Smb {
  let client: SMB2 | null = null
  const root = joinPath(rootSegments(config))
  const target = (path: string) => smbPath(root, path)

  const drop = () => {
    try {
      client?.disconnect()
    } catch {
      // Déjà fermée : rien à faire, on en ouvrira une autre.
    }
    client = null
  }

  async function run<T>(operation: (smb: SMB2) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      client ??= newClient(config)
      try {
        return await withTimeout(operation(client), OPERATION_TIMEOUT_MS)
      } catch (error) {
        const code = (error as SmbError | null)?.code ?? ''
        const broken = code === 'STATUS_CONNECTION_DISCONNECTED' || code === 'EPIPE' || code === 'ECONNRESET' || error instanceof ServiceError
        if (broken) drop()
        if (!broken || attempt > 0) throw smbError(error)
      }
    }
  }

  const statOf = (smb: SMB2, path: string) => promisify<{ isDirectory(): boolean; size: number; mtime: Date | number }>((done) => smb.stat(path, done))
  const listOf = (smb: SMB2, path: string) =>
    promisify<{ name: string; size: number; mtime: Date | number; isDirectory(): boolean }[]>((done) => smb.readdir(path, { stats: true }, done))

  async function removeTree(smb: SMB2, path: string, folder: boolean): Promise<void> {
    if (folder) {
      for (const entry of await listOf(smb, path)) await removeTree(smb, `${path}\\${entry.name}`, entry.isDirectory())
      await promisify<void>((done) => smb.rmdir(path, done)).catch((error: unknown) => {
        if (!isGone(error)) throw error
      })
      return
    }
    await promisify<void>((done) => smb.unlink(path, done)).catch((error: unknown) => {
      if (!isGone(error)) throw error
    })
  }

  return {
    list: (path) =>
      run(async (smb) => {
        const segments = splitPath(path)
        const entries = await listOf(smb, target(path))
        return entries
          .filter((entry) => !HIDDEN.has(entry.name.toLowerCase()) && !entry.name.toLowerCase().startsWith('.trash-'))
          .map((entry): FileEntry => ({
            name: entry.name,
            path: joinPath([...segments, entry.name]),
            kind: entry.isDirectory() ? 'folder' : 'file',
            size: entry.size || 0,
            modifiedAt: toMillis(entry.mtime),
          }))
          .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name, 'fr', { numeric: true }) : a.kind === 'folder' ? -1 : 1))
      }),
    stat: (path) =>
      run(async (smb) => {
        const stats = await statOf(smb, target(path))
        return { kind: stats.isDirectory() ? 'folder' : 'file', size: stats.size || 0, modifiedAt: toMillis(stats.mtime) }
      }),
    readStream: (path) => run((smb) => promisify<Readable>((done) => smb.createReadStream(target(path), done))),
    zipStream(path) {
      // Sans compression : des vidéos ne gagnent rien à être compressées, et le CPU reste libre.
      const archive = archiver('zip', { store: true })
      const addFolder = async (remote: string, inArchive: string): Promise<void> => {
        const entries = await run((smb) => listOf(smb, remote))
        for (const entry of entries) {
          const child = `${remote}\\${entry.name}`
          const name = inArchive ? `${inArchive}/${entry.name}` : entry.name
          if (entry.isDirectory()) {
            await addFolder(child, name)
            continue
          }
          const stream = await run((smb) => promisify<Readable>((done) => smb.createReadStream(child, done)))
          // Un fichier à la fois : archiver lit les flux dans l'ordre, en ouvrir cent d'un coup saturerait la connexion.
          await new Promise<void>((resolve, reject) => {
            stream.once('end', resolve)
            stream.once('error', reject)
            archive.append(stream, { name, date: new Date(toMillis(entry.mtime) || Date.now()) })
          })
        }
      }
      addFolder(target(path), '')
        .then(() => archive.finalize())
        .catch((error: unknown) => archive.destroy(smbError(error)))
      return archive
    },
    remove: (path) =>
      run(async (smb) => {
        if (splitPath(path).length === 0) throw new ServiceError(SERVICE, 'Le dossier racine ne se supprime pas.')
        const stats = await statOf(smb, target(path))
        await removeTree(smb, target(path), stats.isDirectory())
      }),
  }
}

/**
 * Le test de Réglages. Un partage « public » (Unraid) ouvre une session
 * invité quel que soit le mot de passe : on sonde aussi avec un compte
 * inventé (jamais le vrai, pour ne pas le verrouiller) pour le signaler,
 * comme le faisait MediaHub.
 */
export async function testSmb(config: SmbConfig): Promise<string> {
  const probe = async (candidate: SmbConfig, path: string) => {
    const smb = newClient(candidate)
    try {
      await withTimeout(promisify<string[]>((done) => smb.readdir(path, done)), TEST_TIMEOUT_MS)
    } finally {
      try {
        smb.disconnect()
      } catch {
        // Connexion jamais ouverte : rien à fermer.
      }
    }
  }
  try {
    await probe(config, '')
  } catch (error) {
    throw smbError(error)
  }
  const root = joinPath(rootSegments(config))
  if (root) {
    try {
      await probe(config, smbPath(root, ''))
    } catch (error) {
      throw new ServiceError(SERVICE, `Connexion établie, mais le dossier racine « ${root} » est introuvable dans « ${config.share} ».`, { cause: error })
    }
  }
  const random = () => Math.random().toString(36).slice(2, 12)
  const open = await probe({ ...config, username: `onyxhub-sonde-${random()}`, password: random() }, '').then(
    () => true,
    () => false,
  )
  return open
    ? `Le partage « ${config.share} » répond, mais il accepte n'importe quel compte (partage public) : les identifiants ne sont pas vérifiés.`
    : `Le partage « ${config.share} » répond.`
}

export function smbConfig(): SmbConfig | null {
  const host = getSetting('smb_host')?.trim()
  const share = getSetting('smb_share')?.trim()
  if (!host || !share) return null
  return {
    host,
    share,
    username: getSetting('smb_username')?.trim() ?? '',
    password: getSetting('smb_password') ?? '',
    rootPath: getSetting('smb_root_path')?.trim() ?? '',
  }
}

// Gardé entre les requêtes (et les rechargements de dev) tant que Réglages ne change pas.
const globalForSmb = globalThis as unknown as { onyxhubSmb?: { key: string; smb: Smb } }

export function getSmb(): Smb {
  const config = smbConfig()
  if (!config) throw new NotConfiguredError(SERVICE)
  const key = JSON.stringify(config)
  if (globalForSmb.onyxhubSmb?.key !== key) globalForSmb.onyxhubSmb = { key, smb: createSmb(config) }
  return globalForSmb.onyxhubSmb.smb
}
