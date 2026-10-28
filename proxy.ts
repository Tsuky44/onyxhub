import { NextResponse, type NextRequest } from 'next/server'

/**
 * Premier filtre, avant tout rendu : sans cookie de session, on part vers la
 * connexion. Il ne vérifie pas le cookie (ça se fait dans `getViewer`, contre
 * Onyx) : il évite seulement de rendre une page pour rien.
 */
const SESSION_COOKIE = 'onyxhub_session'

/** Chemins accessibles sans session, chacun avec sa propre authentification ou aucune à protéger. */
const PUBLIC_PREFIXES = [
  '/connexion',
  // Routes appelées par le serveur Onyx : elles exigent la clé d'intégration (ADR-0002).
  '/api/request',
  '/api/media/availability',
  // Le bouton « Tester » d'Onyx : même clé (ADR-0009).
  '/api/integration/ping',
  // Les envois de sorraa (événements, téléchargements) : même clé. Redirigés
  // vers la connexion, ils recevaient un 200 de la page et sorraa les croyait livrés.
  '/api/integration/sorraa',
  // Webhooks Radarr/Sonarr (phase 3) : authentifiés par leur propre jeton.
  '/api/webhooks',
  // Liens de partage de fichiers : le jeton (et le mot de passe éventuel) tient lieu d'accès.
  '/partage',
  '/api/partage',
]

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  if (PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return NextResponse.next()
  }
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next()

  const login = new URL('/connexion', request.url)
  if (pathname !== '/') login.searchParams.set('suite', `${pathname}${search}`)
  return NextResponse.redirect(login)
}

export const config = {
  // Ni les fichiers de Next, ni la marque, ni l'icône : la page de connexion en a besoin.
  matcher: ['/((?!_next/|brand/|icon\\.svg|favicon\\.ico).*)'],
}
