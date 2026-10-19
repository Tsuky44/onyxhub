import 'server-only'
import { Readable } from 'node:stream'
import type { Smb } from '../services/smb/client'
import { baseName } from '../services/smb/paths'

/**
 * Un fichier (ou un dossier, en ZIP) du partage SMB en réponse HTTP, lu au fil
 * de l'envoi : rien n'est chargé en mémoire ni écrit sur disque. Sert à
 * l'explorateur (admin) et aux liens de partage publics.
 */
export function contentDisposition(name: string): string {
  // `filename` en ASCII pour les vieux clients, `filename*` en UTF-8 pour les accents.
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`
}

export async function smbDownload(smb: Smb, path: string, signal?: AbortSignal): Promise<Response> {
  const stats = await smb.stat(path)
  const name = baseName(path, 'partage')
  const source = stats.kind === 'folder' ? smb.zipStream(path) : await smb.readStream(path)
  // Le client abandonne (onglet fermé) : on arrête de lire le partage.
  signal?.addEventListener('abort', () => source.destroy(), { once: true })
  const headers = new Headers({
    'Content-Type': stats.kind === 'folder' ? 'application/zip' : 'application/octet-stream',
    'Content-Disposition': contentDisposition(stats.kind === 'folder' ? `${name}.zip` : name),
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  if (stats.kind === 'file') headers.set('Content-Length', String(stats.size))
  return new Response(Readable.toWeb(source) as ReadableStream<Uint8Array>, { headers })
}
