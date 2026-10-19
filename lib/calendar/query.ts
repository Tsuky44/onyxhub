/**
 * L'état du calendrier vit dans l'URL (`?vue=semaine&date=2026-10-19&type=film&miens=1`) :
 * la page se rend côté serveur, se partage et survit au retour arrière.
 * Les dates sont des jours AAAA-MM-JJ calculés en UTC, sans fuseau : un
 * changement d'heure ne décale jamais un jour. Sans dépendance serveur.
 */
export const CALENDAR_VIEWS = [
  { id: 'mois', label: 'Mois' },
  { id: 'semaine', label: 'Semaine' },
  { id: 'liste', label: 'Liste' },
] as const

export type CalendarView = (typeof CALENDAR_VIEWS)[number]['id']
export type CalendarType = 'tout' | 'film' | 'serie'

export interface CalendarQuery {
  view: CalendarView
  /** Le jour qui ancre la période affichée. */
  date: string
  type: CalendarType
  /** Seulement mes demandes et mes abonnements. */
  mine: boolean
}

export interface CalendarRange {
  /** Premier et dernier jour lus (inclus). */
  from: string
  to: string
  /** Les jours affichés : semaines complètes pour le mois, sept jours pour la semaine, le mois pour la liste. */
  days: string[]
  /** « octobre 2026 », « 19 – 25 oct. 2026 ». */
  label: string
}

type Params = Record<string, string | string[] | undefined>

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function toDate(day: string): Date {
  const [year = 1970, month = 1, date = 1] = day.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, date))
}

function toDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function addDays(day: string, count: number): string {
  const date = toDate(day)
  date.setUTCDate(date.getUTCDate() + count)
  return toDay(date)
}

function isValidDay(day: string | undefined): day is string {
  return Boolean(day && DAY_PATTERN.test(day) && toDay(toDate(day)) === day)
}

export function parseCalendarQuery(params: Params, today: string): CalendarQuery {
  const view = first(params.vue)
  const date = first(params.date)
  const type = first(params.type)
  return {
    view: CALENDAR_VIEWS.some((item) => item.id === view) ? (view as CalendarView) : 'mois',
    date: isValidDay(date) ? date : today,
    type: type === 'film' || type === 'serie' ? type : 'tout',
    mine: first(params.miens) === '1',
  }
}

/** Le lundi de la semaine du jour. */
export function weekStart(day: string): string {
  const offset = (toDate(day).getUTCDay() + 6) % 7
  return addDays(day, -offset)
}

function monthBounds(day: string): { start: string; end: string } {
  const date = toDate(day)
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
  return { start: toDay(start), end: toDay(end) }
}

function daysBetween(from: string, to: string): string[] {
  const days: string[] = []
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day)
  return days
}

const MONTH = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const SHORT = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const SHORT_YEAR = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

function weekLabel(start: string, end: string): string {
  if (start.slice(0, 7) === end.slice(0, 7)) return `${toDate(start).getUTCDate()} – ${SHORT_YEAR.format(toDate(end))}`
  if (start.slice(0, 4) === end.slice(0, 4)) return `${SHORT.format(toDate(start))} – ${SHORT_YEAR.format(toDate(end))}`
  return `${SHORT_YEAR.format(toDate(start))} – ${SHORT_YEAR.format(toDate(end))}`
}

export function calendarRange(query: CalendarQuery): CalendarRange {
  if (query.view === 'semaine') {
    const start = weekStart(query.date)
    const end = addDays(start, 6)
    return { from: start, to: end, days: daysBetween(start, end), label: weekLabel(start, end) }
  }
  const { start, end } = monthBounds(query.date)
  const label = MONTH.format(toDate(start))
  if (query.view === 'liste') return { from: start, to: end, days: daysBetween(start, end), label }
  // Le mois en semaines complètes, du lundi au dimanche : les jours des mois voisins se lisent aussi.
  const gridStart = weekStart(start)
  const gridEnd = addDays(weekStart(end), 6)
  return { from: gridStart, to: gridEnd, days: daysBetween(gridStart, gridEnd), label }
}

/** Le jour d'ancrage de la période précédente (-1) ou suivante (+1). */
export function shiftDate(query: CalendarQuery, direction: -1 | 1): string {
  if (query.view === 'semaine') return addDays(weekStart(query.date), 7 * direction)
  const date = toDate(query.date)
  return toDay(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + direction, 1)))
}

export function calendarHref(query: CalendarQuery, patch: Partial<CalendarQuery> = {}, today?: string): string {
  const next = { ...query, ...patch }
  const params = new URLSearchParams()
  if (next.view !== 'mois') params.set('vue', next.view)
  if (next.date !== today) params.set('date', next.date)
  if (next.type !== 'tout') params.set('type', next.type)
  if (next.mine) params.set('miens', '1')
  const search = params.toString()
  return search ? `/calendrier?${search}` : '/calendrier'
}

const WEEKDAY = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })

/** « Lundi 19 octobre ». */
export function dayTitle(day: string): string {
  const label = WEEKDAY.format(toDate(day))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** Le numéro du jour dans le mois (« 19 »). */
export function dayNumber(day: string): number {
  return toDate(day).getUTCDate()
}

/** Les filtres Films / Séries et « Les miens » (mes demandes et mes abonnements). */
export function matchesQuery(release: { mediaType: 'movie' | 'tv'; mine: boolean; subscribed: boolean }, query: Pick<CalendarQuery, 'type' | 'mine'>): boolean {
  if (query.type === 'film' && release.mediaType !== 'movie') return false
  if (query.type === 'serie' && release.mediaType !== 'tv') return false
  return !query.mine || release.mine || release.subscribed
}

/** Les sorties rangées par jour, dans l'ordre reçu. */
export function byDay<T extends { date: string }>(releases: readonly T[]): Map<string, T[]> {
  const days = new Map<string, T[]>()
  for (const release of releases) days.set(release.date, [...(days.get(release.date) ?? []), release])
  return days
}

const WEEKDAY_SHORT = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', timeZone: 'UTC' })

/** « lun. », « mar. »… */
export function weekdayShort(day: string): string {
  return WEEKDAY_SHORT.format(toDate(day))
}
