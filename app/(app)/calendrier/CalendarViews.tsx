import Link from 'next/link'
import { ReleaseBadge, ReleaseRow, releaseSubtitle } from '@/components/calendar/ReleaseRow'
import { MonthSkeleton } from '@/components/calendar/MonthView'
import { Poster } from '@/components/media/Poster'
import { cn } from '@/lib/cn'
import { byDay, dayNumber, dayTitle, weekdayShort } from '@/lib/calendar/query'
import type { UpcomingRelease } from '@/lib/calendar/upcoming'
import { mediaHref } from '@/lib/requests/format'

function WeekItem({ release }: { release: UpcomingRelease }) {
  const content = (
    <>
      <Poster path={release.posterPath} title={release.title} sizes="(min-width: 768px) 160px, 40px" source="w342" compact className="w-10 shrink-0 md:w-full" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="line-clamp-2 text-subhead font-semibold text-text">{release.title}</span>
        <span className="truncate text-footnote text-text-muted">{releaseSubtitle(release)}</span>
        <ReleaseBadge release={release} className="self-start" />
      </span>
    </>
  )
  const className = 'flex gap-3 rounded-card p-2 -m-2 md:flex-col md:gap-2'
  return (
    <li>
      {release.tmdbId ? (
        <Link href={mediaHref(release.mediaType, release.tmdbId)} className={cn(className, 'transition-colors duration-(--motion-micro) ease-onyx hover:bg-glass-fill')}>
          {content}
        </Link>
      ) : (
        <div className={className}>{content}</div>
      )}
    </li>
  )
}

/** Sept colonnes sur grand écran, les jours à la suite sur téléphone (les jours vides y sont omis, sauf aujourd'hui). */
export function WeekView({ days, today, releases }: { days: string[]; today: string; releases: UpcomingRelease[] }) {
  const grouped = byDay(releases)
  return (
    <ol className="grid gap-3 md:grid-cols-7">
      {days.map((day) => {
        const items = grouped.get(day) ?? []
        const isToday = day === today
        return (
          <li
            key={day}
            className={cn(
              'flex min-w-0 flex-col rounded-panel border bg-surface p-4 md:p-3',
              isToday ? 'border-accent/60' : 'border-glass-border',
              items.length === 0 && !isToday && 'hidden md:flex',
            )}
          >
            <h3 className="mb-3 flex items-baseline gap-2 md:flex-col md:gap-0">
              <span className={cn('text-footnote font-semibold uppercase', isToday ? 'text-accent-muted' : 'text-text-muted')}>{weekdayShort(day)}</span>
              <span className="font-mono text-title3 font-semibold text-text">{dayNumber(day)}</span>
              <span className="sr-only">{dayTitle(day)}</span>
            </h3>
            {items.length === 0 ? (
              <p className="text-footnote text-text-muted">Rien ce jour-là</p>
            ) : (
              <ul className="flex flex-col gap-5">
                {items.map((release) => (
                  <WeekItem key={release.id} release={release} />
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </ol>
  )
}

/** Les jours du mois qui ont des sorties, à la suite : la vue la plus lisible au téléphone. */
export function ListView({ today, releases }: { today: string; releases: UpcomingRelease[] }) {
  return (
    <div className="flex flex-col gap-4">
      {[...byDay(releases)].map(([day, items]) => (
        <section key={day} aria-labelledby={`jour-${day}`} className={cn('rounded-panel border bg-surface p-5', day === today ? 'border-accent/60' : 'border-glass-border')}>
          <h3 id={`jour-${day}`} className="mb-4 text-headline font-semibold text-text">
            {dayTitle(day)}
            {day === today && <span className="ml-2 text-footnote font-medium text-accent-muted">Aujourd&apos;hui</span>}
          </h3>
          <ul className="flex flex-col gap-4">
            {items.map((release) => (
              <ReleaseRow key={release.id} release={release} size="md" />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

/** La place du calendrier pendant le chargement, à la forme de la vue : rien ne saute à l'arrivée. */
export function CalendarSkeleton({ view, days }: { view: 'mois' | 'semaine' | 'liste'; days: number }) {
  if (view === 'mois') return <MonthSkeleton days={days} />
  return (
    <div aria-hidden className={cn('grid gap-3', view === 'semaine' && 'md:grid-cols-7')}>
      {Array.from({ length: view === 'semaine' ? 7 : 4 }, (_, index) => (
        <div key={index} className="h-40 animate-pulse rounded-panel bg-surface" />
      ))}
    </div>
  )
}
