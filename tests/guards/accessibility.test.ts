import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { offendingLines, ROOT, sourceFiles } from './source-files'

/**
 * Deux règles d'accessibilité de PRODUCT.md tenues par des tests plutôt que
 * par la relecture : un texte lisible sur chaque fond charbon (WCAG AA,
 * 4,5:1), et des cibles tactiles de 44 px sur téléphone.
 */
const css = readFileSync(join(ROOT, 'app', 'globals.css'), 'utf8')

function token(name: string): string {
  const match = new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css)
  if (!match?.[1]) throw new Error(`token --color-${name} introuvable dans globals.css`)
  return match[1]
}

function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((index) => {
    const channel = Number.parseInt(hex.slice(index, index + 2), 16) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a) as [number, number]
  return (light + 0.05) / (dark + 0.05)
}

/** Les couleurs posées en texte, et les fonds sur lesquels elles se lisent. */
const TEXT = ['text', 'text-secondary', 'text-muted', 'accent-muted', 'success', 'warning', 'error']
const BACKGROUNDS = ['bg', 'surface', 'elevated']

describe('accessibilité', () => {
  it('garde chaque couleur de texte à 4,5:1 au moins sur les fonds charbon', () => {
    const failures = TEXT.flatMap((text) =>
      BACKGROUNDS.flatMap((background) => {
        const ratio = contrast(token(text), token(background))
        return ratio < 4.5 ? [`${text} sur ${background} : ${ratio.toFixed(2)}:1`] : []
      }),
    )
    expect(failures, 'Un texte sous 4,5:1 ne se lit pas sur charbon (WCAG AA). Éclaircis le token dans globals.css, voir ADR-0006.').toEqual([])
  })

  it('ne pose pas de cible tactile de 40 px sans la porter à 44 px sur téléphone', () => {
    // `size-10` et `min-h-10` ne servent qu'aux boutons et liens ici : seuls, ils font 40 px même au doigt.
    const pattern = /(?<![:\w-])(?:size-10|min-h-10)\b/
    const found = sourceFiles(['.tsx']).flatMap((file) => offendingLines(file, pattern))
    expect(found, 'Cible de 40 px : écris `size-11 shell:size-10` (ou `min-h-11 shell:min-h-10`), 44 px au doigt, compact au pointeur.').toEqual([])
  })
})
