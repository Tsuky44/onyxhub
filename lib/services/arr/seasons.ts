import type { SonarrSeason } from './types'

/**
 * Quelles saisons surveiller après une demande. Une demande **ajoute** des
 * saisons, elle n'en retire jamais : MediaHub recalculait la liste à partir
 * de la seule demande en cours et désurveillait les saisons demandées avant
 * (il compensait en relisant toutes les anciennes demandes).
 *
 * `requested` vaut `'all'` pour « toute la série » : toutes les saisons sauf
 * les épisodes spéciaux (saison 0), comme le fait Sonarr par défaut.
 */
export function planSeasons(
  existing: readonly SonarrSeason[],
  requested: readonly number[] | 'all',
): { seasons: SonarrSeason[]; newlyMonitored: number[] } {
  const wanted = new Set(
    requested === 'all' ? existing.map((season) => season.seasonNumber).filter((number) => number > 0) : requested,
  )
  const newlyMonitored: number[] = []
  const seasons = existing.map((season) => {
    if (season.monitored || !wanted.has(season.seasonNumber)) return season
    newlyMonitored.push(season.seasonNumber)
    return { ...season, monitored: true }
  })
  return { seasons, newlyMonitored: newlyMonitored.sort((a, b) => a - b) }
}

/** Pour une série encore absente de Sonarr : seules les saisons demandées sont surveillées. */
export function initialSeasons(lookup: readonly SonarrSeason[], requested: readonly number[] | 'all'): SonarrSeason[] {
  const wanted = requested === 'all' ? null : new Set(requested)
  return lookup.map((season) => ({
    ...season,
    monitored: wanted ? wanted.has(season.seasonNumber) : season.seasonNumber > 0,
  }))
}
