import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

/** La racine du dépôt, d'où partent tous les chemins des guard tests. */
export const ROOT = join(import.meta.dirname, '..', '..')

/** Les dossiers de code de l'app. Le reste (node_modules, .next, .claude, data) n'est jamais scanné. */
const SOURCE_DIRS = ['app', 'components', 'lib', 'tests']

export interface SourceFile {
  /** Chemin relatif à la racine, avec des `/` même sous Windows. */
  path: string
  content: string
}

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else out.push(full)
  }
}

export function sourceFiles(extensions: readonly string[]): SourceFile[] {
  const files: string[] = []
  for (const dir of SOURCE_DIRS) walk(join(ROOT, dir), files)
  return files
    .filter((file) => extensions.some((ext) => file.endsWith(ext)))
    .map((file) => ({
      path: relative(ROOT, file).split(sep).join('/'),
      content: readFileSync(file, 'utf8'),
    }))
}

/** Les lignes d'un fichier qui correspondent à un motif, pour des messages d'échec précis. */
export function offendingLines(file: SourceFile, pattern: RegExp): string[] {
  return file.content
    .split('\n')
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => pattern.test(line))
    .map(({ line, number }) => `${file.path}:${number}  ${line.trim()}`)
}
