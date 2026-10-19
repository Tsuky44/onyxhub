/**
 * Les types de `@marsaud/smb2`, qui n'en publie pas : seulement ce
 * qu'OnyxHub appelle, en style callback (le seul que toutes ses versions
 * acceptent).
 */
declare module '@marsaud/smb2' {
  import type { Readable } from 'node:stream'

  interface SmbStats {
    name: string
    size: number
    mtime: Date | number
    isDirectory(): boolean
  }

  type Callback<T> = (error: (Error & { code?: string }) | null, value: T) => void

  export default class SMB2 {
    constructor(options: {
      share: string
      domain?: string
      username?: string
      password?: string
      autoCloseTimeout?: number
      packetConcurrency?: number
    })
    readdir(path: string, options: { stats: true }, callback: Callback<SmbStats[]>): void
    readdir(path: string, callback: Callback<string[]>): void
    stat(path: string, callback: Callback<SmbStats>): void
    createReadStream(path: string, callback: Callback<Readable>): void
    unlink(path: string, callback: Callback<void>): void
    rmdir(path: string, callback: Callback<void>): void
    disconnect(): void
  }
}
