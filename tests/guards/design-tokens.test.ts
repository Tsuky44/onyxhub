import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { offendingLines, ROOT, sourceFiles } from './source-files'

/**
 * La charte Quiet Premium vit dans app/globals.css (@theme). Ces tests
 * refusent ce qui la contournerait depuis le code : une couleur, une taille
 * de texte ou une durée écrite en dur. Une valeur qui manque s'ajoute au
 * @theme, avec son rôle, avant d'être utilisée.
 */
const code = sourceFiles(['.ts', '.tsx']).filter((file) => !file.path.startsWith('tests/guards/'))

/**
 * Exceptions, chacune justifiée.
 * - app/layout.tsx : `viewport.themeColor` est lu par le navigateur avant tout
 *   CSS, il ne peut pas pointer vers une variable.
 */
const RAW_COLOR_ALLOWED = new Set(['app/layout.tsx'])

describe('tokens de design', () => {
  it("n'écrit aucune couleur en dur hors du @theme", () => {
    const pattern = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch)\(/
    const found = code.filter((file) => !RAW_COLOR_ALLOWED.has(file.path)).flatMap((file) => offendingLines(file, pattern))
    expect(found, 'Utilise une couleur du @theme (bg-surface, text-text-secondary…)').toEqual([])
  })

  it("n'utilise que les 13 tailles de texte d'AppType", () => {
    // `text-[17px]`, `text-[1.1rem]`, ou `fontSize:` en style inline.
    const pattern = /\btext-\[\d|\bfontSize\s*:/
    const found = code.flatMap((file) => offendingLines(file, pattern))
    expect(found, 'Utilise text-micro … text-hero ; une taille manquante s\'ajoute au @theme').toEqual([])
  })

  it('reste dans la plage de durées 180–280 ms via les variables --motion-*', () => {
    // `duration-300`, `duration-[350ms]`, ou une durée en ms dans un style inline.
    const pattern = /\bduration-(?:\d|\[)|\btransition(?:Duration)?\s*:\s*['"`][^'"`]*\d+m?s/
    const found = code.flatMap((file) => offendingLines(file, pattern))
    expect(found, 'Utilise duration-(--motion-micro|standard|emphasis)').toEqual([])
  })

  it('déclare les points de rupture en rem, comme ceux de Tailwind', () => {
    // En px, Tailwind ne sait pas ranger un point de rupture parmi les siens : `sm:` passait après `shell:` et l'écrasait.
    const css = readFileSync(join(ROOT, 'app', 'globals.css'), 'utf8')
    const found = css.split('\n').filter((line) => /--breakpoint-[\w-]+:\s*[\d.]+px/.test(line))
    expect(found, 'Écris le point de rupture en rem (900px = 56.25rem)').toEqual([])
  })
})
