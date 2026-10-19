import 'server-only'
import { createHash } from 'node:crypto'
import { notFound, redirect } from 'next/navigation'
import { cache } from 'react'
import { fetchMe } from '../services/onyx/auth'
import { toViewer, type Viewer } from './permissions'
import { readSession } from './session'

export type { Viewer } from './permissions'

/**
 * Chaque page demande « qui regarde ? ». Interroger Onyx à chaque fois
 * coûterait un aller-retour par navigation ; un cache de 30 s, indexé par
 * l'empreinte du jeton, ne retarde une révocation ou un changement de droits
 * que de 30 s au plus.
 */
const ME_TTL_MS = 30_000
const ME_CACHE_MAX = 200
const meCache = new Map<string, { viewer: Viewer; expiresAt: number }>()

function remember(key: string, viewer: Viewer): void {
  if (meCache.size >= ME_CACHE_MAX) {
    const oldest = meCache.keys().next().value
    if (oldest !== undefined) meCache.delete(oldest)
  }
  meCache.set(key, { viewer, expiresAt: Date.now() + ME_TTL_MS })
}

/**
 * Le compte connecté, ou `null`. Mis en cache pour la durée d'une requête
 * (`cache` de React) en plus du cache de 30 s. Si Onyx ne répond pas, l'erreur
 * remonte : on ne déconnecte pas les gens parce qu'Onyx redémarre.
 */
export const getOptionalViewer = cache(async (): Promise<Viewer | null> => {
  const session = await readSession()
  if (!session) return null

  const key = createHash('sha256').update(session.token).digest('hex')
  const hit = meCache.get(key)
  if (hit && hit.expiresAt > Date.now()) return hit.viewer

  const user = await fetchMe(session.token)
  if (!user) {
    meCache.delete(key)
    return null
  }
  const viewer = toViewer(user)
  remember(key, viewer)
  return viewer
})

/** Le compte connecté ; renvoie vers la connexion sinon. Seul point d'entrée de l'identité (ADR-0001). */
export async function getViewer(): Promise<Viewer> {
  const viewer = await getOptionalViewer()
  if (!viewer) redirect('/connexion')
  return viewer
}

/** Arrête le rendu d'une page admin pour un autre compte : elle n'existe pas pour lui. */
export async function requireAdmin(): Promise<Viewer> {
  const viewer = await getViewer()
  if (!viewer.isAdmin) notFound()
  return viewer
}

/** Oublie le compte en cache d'un jeton (déconnexion). */
export function forgetToken(token: string): void {
  meCache.delete(createHash('sha256').update(token).digest('hex'))
}
