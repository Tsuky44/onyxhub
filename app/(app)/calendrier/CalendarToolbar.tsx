import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { CALENDAR_VIEWS, calendarHref, shiftDate, type CalendarQuery, type CalendarRange, type CalendarType } from '@/lib/calendar/query'
import { ChevronLeftIcon, ChevronRightIcon } from '@/lib/icons'

const TYPES: { id: CalendarType; label: string }[] = [
  { id: 'tout', label: 'Tout' },
  { id: 'film', label: 'Films' },
  { id: 'serie', label: 'Séries' },
]

const linkBase = 'inline-flex min-h-11 shell:min-h-10 items-center rounded-full text-subhead whitespace-nowrap transition-colors duration-(--motion-micro) ease-onyx'

function Segment({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={cn(linkBase, 'px-4', active ? 'bg-elevated font-semibold text-text' : 'font-medium text-text-secondary hover:text-text')}
    >
      {children}
    </Link>
  )
}

/**
 * Période, navigation, vue et filtres : de simples liens, la page se rend
 * côté serveur et chaque état a son URL. Aucun script pour naviguer.
 */
export function CalendarToolbar({ query, range, today }: { query: CalendarQuery; range: CalendarRange; today: string }) {
  const unit = query.view === 'semaine' ? 'Semaine' : 'Mois'
  const navButton = 'flex size-11 shell:size-10 items-center justify-center rounded-full text-text-secondary transition-colors duration-(--motion-micro) ease-onyx hover:bg-glass-fill hover:text-text'
  return (
    <div className="mb-6 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-title2 font-bold text-text first-letter:uppercase" aria-live="polite">
          {range.label}
        </h2>
        <nav aria-label="Période" className="flex items-center gap-1 rounded-full border border-glass-border bg-surface p-1">
          <Link href={calendarHref(query, { date: shiftDate(query, -1) }, today)} aria-label={`${unit} précédent${unit === 'Semaine' ? 'e' : ''}`} className={navButton}>
            <ChevronLeftIcon size={18} aria-hidden />
          </Link>
          <Link href={calendarHref(query, { date: today }, today)} className={cn(linkBase, 'px-3 font-medium text-text-secondary hover:text-text')}>
            Aujourd&apos;hui
          </Link>
          <Link href={calendarHref(query, { date: shiftDate(query, 1) }, today)} aria-label={`${unit} suivant${unit === 'Semaine' ? 'e' : ''}`} className={navButton}>
            <ChevronRightIcon size={18} aria-hidden />
          </Link>
        </nav>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <nav aria-label="Vue" className="inline-flex rounded-full border border-glass-border bg-surface p-1">
          {CALENDAR_VIEWS.map((view) => (
            <Segment key={view.id} href={calendarHref(query, { view: view.id }, today)} active={query.view === view.id}>
              {view.label}
            </Segment>
          ))}
        </nav>
        <nav aria-label="Filtres" className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-glass-border bg-surface p-1">
            {TYPES.map((type) => (
              <Segment key={type.id} href={calendarHref(query, { type: type.id }, today)} active={query.type === type.id}>
                {type.label}
              </Segment>
            ))}
          </div>
          <Link
            href={calendarHref(query, { mine: !query.mine }, today)}
            aria-current={query.mine ? 'true' : undefined}
            className={cn(
              linkBase,
              'border px-3.5 font-medium',
              query.mine ? 'border-text bg-text text-on-primary' : 'border-glass-border bg-glass-fill text-text-secondary hover:text-text',
            )}
          >
            Les miens
          </Link>
        </nav>
      </div>
    </div>
  )
}
