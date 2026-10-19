import { expect, it } from 'vitest'
import { offendingLines, sourceFiles } from './source-files'

/**
 * Une seule famille d'icônes, importée à un seul endroit (lib/icons.ts),
 * comme AppIcons dans Onyx. MediaHub mélangeait lucide-react et heroicons.
 */
it("n'importe les icônes que depuis lib/icons.ts", () => {
  const pattern = /from\s+['"](?:@phosphor-icons\/|lucide-react|@heroicons\/|react-icons)/
  const found = sourceFiles(['.ts', '.tsx'])
    .filter((file) => file.path !== 'lib/icons.ts' && !file.path.startsWith('tests/guards/'))
    .flatMap((file) => offendingLines(file, pattern))

  expect(found, 'Ajoute l\'icône à lib/icons.ts et importe-la depuis @/lib/icons').toEqual([])
})
