import { describe, expect, it } from 'vitest'
import { combineDownloads, type DownloadProgress } from './downloads'
import { advance, estimate, formatPercent } from './live-progress'

const download = (fields: Partial<DownloadProgress> = {}): DownloadProgress => ({
  title: 'The.Matrix',
  seasonNumber: null,
  progress: 40,
  size: 1000,
  sizeLeft: 600,
  speed: 10,
  eta: 60,
  stalled: false,
  ...fields,
})

describe('barre prolongée entre deux mesures', () => {
  it('avance à la vitesse mesurée', () => {
    expect(estimate(download(), 5_000)).toMatchObject({ progress: 45, sizeLeft: 550, eta: 55 })
  })

  it("ne prolonge pas une mesure de plus de 30 s : sorraa s'est peut-être tu", () => {
    expect(estimate(download(), 120_000).progress).toBe(estimate(download(), 30_000).progress)
  })

  it("n'annonce jamais la fin : seul le client de téléchargement la dit", () => {
    expect(estimate(download({ progress: 99, sizeLeft: 10 }), 30_000).progress).toBe(99.9)
  })

  it('laisse immobile un téléchargement en pause ou sans vitesse', () => {
    expect(estimate(download({ stalled: true }), 10_000).progress).toBe(40)
    expect(estimate(download({ speed: null }), 10_000).progress).toBe(40)
  })

  it("ralentit sans reculer ni s'arrêter quand l'estimation avait pris un peu d'avance", () => {
    const shown = { a: download({ progress: 48 }) }
    // L'estimation avance de 1 % par seconde : la barre, de 0,5 %, jusqu'à être rattrapée.
    expect(advance(shown, { a: download({ progress: 46 }) }, 1_000).a?.progress).toBe(48.5)
  })

  it('revient à la mesure quand le téléchargement est mis en pause', () => {
    const shown = { a: download({ progress: 48 }) }
    expect(advance(shown, { a: download({ progress: 46, stalled: true }) }, 1_000).a?.progress).toBe(46)
  })

  it('recule pour de vrai quand la release a été remplacée', () => {
    const shown = { a: download({ progress: 80 }) }
    expect(advance(shown, { a: download({ progress: 3 }) }, 0).a?.progress).toBe(3)
  })

  it('oublie un téléchargement que la mesure ne cite plus', () => {
    expect(advance({ a: download() }, {}, 0)).toEqual({})
  })

  it('affiche une décimale sans arrondir vers le haut', () => {
    expect(formatPercent(99.96)).toBe('99,9 %')
  })
})

describe("barre d'un lot de la liste", () => {
  it('réunit les saisons du lot en une barre, à la vitesse cumulée', () => {
    const items = [
      download({ seasonNumber: 1, size: 1000, sizeLeft: 0, speed: 0, eta: null }),
      download({ seasonNumber: 2, size: 1000, sizeLeft: 500, speed: 20, eta: 25 }),
      download({ seasonNumber: 3, size: 1000, sizeLeft: 1000, speed: 30, eta: 40 }),
    ]
    expect(combineDownloads(items, [1, 2], 'GoT')).toMatchObject({ progress: 75, size: 2000, sizeLeft: 500, speed: 20, eta: null })
    expect(combineDownloads(items, [3], 'GoT')).toMatchObject({ progress: 0, speed: 30, eta: 40 })
  })

  it("n'a pas de barre quand aucune release ne concerne le lot", () => {
    expect(combineDownloads([download({ seasonNumber: 4 })], [1], 'GoT')).toBeNull()
  })
})
