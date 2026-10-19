import { describe, expect, it } from 'vitest'
import { calendarHref, calendarRange, matchesQuery, parseCalendarQuery, shiftDate, weekStart } from './query'

const TODAY = '2026-10-19'

describe('état du calendrier dans l\'URL', () => {
  it('prend des valeurs sûres quand les paramètres manquent ou sont faux', () => {
    expect(parseCalendarQuery({}, TODAY)).toEqual({ view: 'mois', date: TODAY, type: 'tout', mine: false })
    expect(parseCalendarQuery({ vue: 'annee', date: '2026-02-30', type: 'livre' }, TODAY)).toEqual({ view: 'mois', date: TODAY, type: 'tout', mine: false })
    expect(parseCalendarQuery({ vue: 'semaine', date: '2026-02-28', type: 'serie', miens: '1' }, TODAY)).toEqual({
      view: 'semaine',
      date: '2026-02-28',
      type: 'serie',
      mine: true,
    })
  })

  it('n\'écrit dans l\'URL que ce qui diffère des valeurs par défaut', () => {
    const query = parseCalendarQuery({}, TODAY)
    expect(calendarHref(query, {}, TODAY)).toBe('/calendrier')
    expect(calendarHref(query, { view: 'liste', type: 'film', mine: true, date: '2026-11-01' }, TODAY)).toBe('/calendrier?vue=liste&date=2026-11-01&type=film&miens=1')
  })
})

describe('périodes', () => {
  it('commence la semaine un lundi', () => {
    expect(weekStart('2026-10-19')).toBe('2026-10-19')
    expect(weekStart('2026-10-25')).toBe('2026-10-19')
  })

  it('montre le mois en semaines complètes, du lundi au dimanche', () => {
    const range = calendarRange({ view: 'mois', date: '2026-10-19', type: 'tout', mine: false })
    expect([range.from, range.to, range.days.length]).toEqual(['2026-09-28', '2026-11-01', 35])
    expect(range.label).toBe('octobre 2026')
  })

  it('garde la liste dans les bornes du mois', () => {
    const range = calendarRange({ view: 'liste', date: '2026-02-10', type: 'tout', mine: false })
    expect([range.from, range.to]).toEqual(['2026-02-01', '2026-02-28'])
  })

  it('nomme une semaine à cheval sur deux mois', () => {
    expect(calendarRange({ view: 'semaine', date: '2026-10-01', type: 'tout', mine: false }).label).toBe('28 sept. – 4 oct. 2026')
    expect(calendarRange({ view: 'semaine', date: '2026-10-19', type: 'tout', mine: false }).label).toBe('19 – 25 oct. 2026')
  })

  it('avance d\'un mois ou d\'une semaine', () => {
    expect(shiftDate({ view: 'mois', date: '2026-01-31', type: 'tout', mine: false }, 1)).toBe('2026-02-01')
    expect(shiftDate({ view: 'semaine', date: '2026-10-21', type: 'tout', mine: false }, -1)).toBe('2026-10-12')
  })

  it('ne se décale pas au changement d\'heure', () => {
    // Le passage à l'heure d'hiver tombe le 25 octobre 2026.
    expect(calendarRange({ view: 'semaine', date: '2026-10-25', type: 'tout', mine: false }).days).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
    ])
  })
})

describe('filtres', () => {
  const release = (mediaType: 'movie' | 'tv', mine = false, subscribed = false) => ({ mediaType, mine, subscribed })

  it('filtre par type et garde mes demandes et mes abonnements pour « Les miens »', () => {
    expect(matchesQuery(release('tv'), { type: 'film', mine: false })).toBe(false)
    expect(matchesQuery(release('movie'), { type: 'film', mine: true })).toBe(false)
    expect(matchesQuery(release('movie', true), { type: 'film', mine: true })).toBe(true)
    expect(matchesQuery(release('tv', false, true), { type: 'tout', mine: true })).toBe(true)
  })
})
