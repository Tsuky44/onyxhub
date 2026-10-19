/**
 * La page où revenir après la connexion. Seul un chemin interne est accepté :
 * `//site.tld` ou `https://…` feraient de la page de connexion un tremplin
 * vers n'importe quel site.
 */
export function safeNextPath(raw: unknown): string {
  if (typeof raw !== 'string') return '/'
  const value = raw.trim()
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/'
  if (value.startsWith('/connexion')) return '/'
  return value
}
