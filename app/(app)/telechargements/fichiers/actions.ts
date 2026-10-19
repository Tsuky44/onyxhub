'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/viewer'
import { createShare, revokeShare, revokeSharesUnder, SHARE_DURATIONS, type ShareDuration, type ShareView } from '@/lib/files/shares'
import { errorMessage } from '@/lib/http'
import { getSmb } from '@/lib/services/smb/client'
import { InvalidPathError, splitPath } from '@/lib/services/smb/paths'

export type FileActionResult = { ok: true; message: string } | { ok: false; message: string }

function validPath(path: unknown): string | null {
  if (typeof path !== 'string') return null
  try {
    return splitPath(path).length > 0 ? path : null
  } catch (error) {
    if (error instanceof InvalidPathError) return null
    throw error
  }
}

/** Supprime un fichier ou un dossier (récursivement) du partage, et les liens qui y menaient. */
export async function deletePathAction(path: string): Promise<FileActionResult> {
  await requireAdmin()
  const target = validPath(path)
  if (!target) return { ok: false, message: 'Chemin invalide.' }
  try {
    await getSmb().remove(target)
    revokeSharesUnder(target)
    revalidatePath('/telechargements/fichiers')
    return { ok: true, message: 'Supprimé.' }
  } catch (error) {
    return { ok: false, message: errorMessage(error) }
  }
}

export async function createShareAction(input: { path: string; duration: ShareDuration; password: string }): Promise<{ ok: true; share: ShareView } | { ok: false; message: string }> {
  const viewer = await requireAdmin()
  const target = validPath(input?.path)
  if (!target) return { ok: false, message: 'Chemin invalide.' }
  const duration = SHARE_DURATIONS.find((entry) => entry.id === input.duration)?.id ?? '7'
  const password = typeof input.password === 'string' ? input.password.trim() : ''
  if (password.length > 200) return { ok: false, message: 'Mot de passe trop long.' }
  try {
    // Le type vient du partage lui-même, pas du client : un dossier se télécharge en ZIP.
    const stats = await getSmb().stat(target)
    const share = await createShare({ path: target, kind: stats.kind, duration, password: password || null, createdBy: viewer.name })
    revalidatePath('/telechargements/fichiers')
    return { ok: true, share }
  } catch (error) {
    return { ok: false, message: errorMessage(error) }
  }
}

export async function revokeShareAction(id: number): Promise<FileActionResult> {
  await requireAdmin()
  if (!Number.isInteger(id) || id <= 0) return { ok: false, message: 'Lien inconnu.' }
  revokeShare(id)
  revalidatePath('/telechargements/fichiers')
  return { ok: true, message: 'Lien révoqué.' }
}
