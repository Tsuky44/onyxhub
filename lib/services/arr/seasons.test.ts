import { describe, expect, it } from 'vitest'
import { initialSeasons, planSeasons } from './seasons'

const season = (seasonNumber: number, monitored: boolean) => ({ seasonNumber, monitored })

describe('saisons demandées', () => {
  it('ne désurveille jamais une saison demandée avant', () => {
    const { seasons, newlyMonitored } = planSeasons([season(1, true), season(2, false), season(3, false)], [3])
    expect(seasons.map((s) => s.monitored)).toEqual([true, false, true])
    expect(newlyMonitored).toEqual([3])
  })

  it("ne compte pas comme nouvelle une saison déjà surveillée", () => {
    expect(planSeasons([season(1, true)], [1]).newlyMonitored).toEqual([])
  })

  it('demande toute la série sans les épisodes spéciaux', () => {
    const { newlyMonitored } = planSeasons([season(0, false), season(1, false), season(2, false)], 'all')
    expect(newlyMonitored).toEqual([1, 2])
  })

  it("ne surveille à l'ajout que les saisons demandées", () => {
    const seasons = initialSeasons([season(0, true), season(1, true), season(2, true)], [2])
    expect(seasons.map((s) => s.monitored)).toEqual([false, false, true])
  })
})
