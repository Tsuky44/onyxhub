import { expect, it } from 'vitest'
import { sourceFiles } from './source-files'

/**
 * Aucun fichier au-delà de 800 lignes, comme dans Onyx (ADR-0052 d'Onyx).
 * MediaHub avait 24 composants au-dessus de 180 lignes et des fichiers de
 * plus de 1 000 : à partir d'une certaine taille, plus personne ne relit, on
 * empile. Pour ajouter du code à un gros fichier, extrais d'abord le morceau
 * touché dans son propre module.
 */
const MAX_LINES = 800

it(`garde chaque fichier sous ${MAX_LINES} lignes`, () => {
  const tooLong = sourceFiles(['.ts', '.tsx', '.css'])
    .map((file) => ({ path: file.path, lines: file.content.split('\n').length }))
    .filter((file) => file.lines > MAX_LINES)
    .map((file) => `${file.path} (${file.lines} lignes)`)

  expect(tooLong, 'Découpe ces fichiers par sujet avant d\'y ajouter du code').toEqual([])
})
