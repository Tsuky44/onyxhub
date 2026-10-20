import 'server-only'
import { headers } from 'next/headers'

/**
 * L'adresse d'OnyxHub telle que le navigateur l'a tapée, lue dans les
 * en-têtes de la requête (ceux du proxy inverse d'abord). C'est la meilleure
 * supposition de l'adresse qu'Onyx doit utiliser quand l'admin ne l'a pas
 * fixée dans Réglages.
 */
export async function requestOrigin(): Promise<string | null> {
  const h = await headers()
  const host = h.get('x-forwarded-host')?.split(',')[0]?.trim() || h.get('host')
  if (!host) return null
  const proto = h.get('x-forwarded-proto')?.split(',')[0]?.trim() === 'https' ? 'https' : 'http'
  return `${proto}://${host}`
}
