import 'server-only'
import { notFound } from 'next/navigation'

export interface Viewer {
  name: string
  /** Permission Onyx `manage_settings` (ou propriétaire). */
  isAdmin: boolean
  /** Permission Onyx `request_media`. */
  canRequest: boolean
}

/**
 * Le compte qui regarde la page.
 *
 * Phase 0 : valeur fixe pour monter le shell. La phase 1 la remplace par la
 * session Onyx (`POST /api/auth/login`, puis `GET /api/auth/me`), sans toucher
 * aux appelants : c'est le seul point d'entrée de l'identité dans l'app.
 */
export async function getViewer(): Promise<Viewer> {
  return { name: 'Mathis', isAdmin: true, canRequest: true }
}

/** Arrête le rendu d'une page admin pour un autre compte : elle n'existe pas pour lui. */
export async function requireAdmin(): Promise<Viewer> {
  const viewer = await getViewer()
  if (!viewer.isAdmin) notFound()
  return viewer
}
