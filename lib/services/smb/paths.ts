/**
 * Les chemins du gestionnaire de fichiers : toujours relatifs au dossier
 * racine de Réglages, écrits avec des `/`. Fonctions pures, sans dépendance
 * serveur.
 *
 * MediaHub laissait passer `..` dans l'explorateur (seule la route de
 * téléchargement le refusait) : un chemin forgé pouvait lister ou supprimer
 * hors du dossier racine. Ici tout chemin passe par `splitPath`, qui refuse.
 */
export class InvalidPathError extends Error {
  constructor() {
    super('Chemin invalide.')
    this.name = 'InvalidPathError'
  }
}

/** Les segments d'un chemin relatif (`films/2024`), ou une erreur pour `..`, un caractère de contrôle ou un segment trop long. */
export function splitPath(input: string | null | undefined): string[] {
  const segments = (input ?? '')
    .replace(/\\/g, '/')
    .split('/')
    .filter((segment) => segment !== '' && segment !== '.')
  for (const segment of segments) {
    if (segment === '..' || /[\u0000-\u001f]/.test(segment) || segment.length > 255) throw new InvalidPathError()
  }
  return segments
}

export function joinPath(segments: readonly string[]): string {
  return segments.join('/')
}

/** Le chemin parent (`a/b` → `a`, `a` → racine). */
export function parentPath(path: string): string {
  return joinPath(splitPath(path).slice(0, -1))
}

/** Le dernier segment, ou `fallback` pour la racine. */
export function baseName(path: string, fallback = 'Racine'): string {
  return splitPath(path).at(-1) ?? fallback
}

/** Le fil d'Ariane : un lien par dossier, racine comprise. */
export function breadcrumbs(path: string): { name: string; path: string }[] {
  const segments = splitPath(path)
  return [{ name: 'Racine', path: '' }, ...segments.map((name, index) => ({ name, path: joinPath(segments.slice(0, index + 1)) }))]
}

/** Le chemin SMB (séparateurs `\`, sans barre de tête) d'un chemin relatif, sous le dossier racine. */
export function smbPath(rootPath: string, path: string): string {
  return [...splitPath(rootPath), ...splitPath(path)].join('\\')
}
