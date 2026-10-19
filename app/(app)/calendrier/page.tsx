import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PanelError } from '@/components/ui/Panel'
import { PageHeader } from '@/components/ui/PageHeader'
import type { Viewer } from '@/lib/auth/viewer'
import { getViewer } from '@/lib/auth/viewer'
import { calendarRange, matchesQuery, parseCalendarQuery, type CalendarQuery, type CalendarRange } from '@/lib/calendar/query'
import { localDay } from '@/lib/calendar/releases'
import { listSubscriptions } from '@/lib/calendar/subscriptions'
import { calendarData } from '@/lib/calendar/upcoming'
import { settle } from '@/lib/home/admin'
import { CalendarToolbar } from './CalendarToolbar'
import { CalendarSkeleton, ListView, WeekView } from './CalendarViews'
import { MonthView } from './MonthView'
import { SubscriptionsButton } from './SubscriptionsButton'

export const metadata: Metadata = { title: 'Calendrier' }

function emptyMessage(query: CalendarQuery): string {
  const period = query.view === 'semaine' ? 'cette semaine' : 'ce mois-ci'
  return query.type !== 'tout' || query.mine ? `Aucune sortie ${period} avec ces filtres.` : `Aucune sortie ${period}.`
}

async function CalendarBody({ query, range, today, viewer }: { query: CalendarQuery; range: CalendarRange; today: string; viewer: Viewer }) {
  const result = await settle(() => calendarData(range.from, range.to, viewer))
  if (!result.ok) {
    return (
      <div className="rounded-panel border border-glass-border bg-surface p-5">
        <PanelError message={result.message} />
      </div>
    )
  }
  const { unavailable, failedSubscriptions } = result.value
  const releases = result.value.releases.filter((release) => matchesQuery(release, query))
  const notices = [
    ...unavailable.map((service) => `${service} ne répond pas : ses sorties manquent.`),
    ...(failedSubscriptions > 0 ? [`${failedSubscriptions} abonnement${failedSubscriptions > 1 ? 's' : ''} n'a pas pu être lu dans TMDB.`] : []),
  ]
  const empty = query.view === 'mois' ? !releases.some((release) => release.date.startsWith(query.date.slice(0, 7))) : releases.length === 0

  return (
    <>
      {notices.length > 0 && (
        <ul role="status" className="mb-4 flex flex-col gap-1">
          {notices.map((notice) => (
            <li key={notice} className="text-footnote text-warning">
              {notice}
            </li>
          ))}
        </ul>
      )}
      {empty && query.view !== 'liste' && <p className="mb-4 text-body text-text-secondary">{emptyMessage(query)}</p>}
      {query.view === 'mois' ? (
        <MonthView days={range.days} month={query.date.slice(0, 7)} today={today} releases={releases} />
      ) : query.view === 'semaine' ? (
        <WeekView days={range.days} today={today} releases={releases} />
      ) : empty ? (
        <div className="rounded-panel border border-glass-border bg-surface p-5 text-body text-text-secondary">{emptyMessage(query)}</div>
      ) : (
        <ListView today={today} releases={releases} />
      )}
    </>
  )
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Chaque page revérifie la session : le layout ne se re-rend pas à la navigation.
  const viewer = await getViewer()
  const today = localDay(new Date())
  const query = parseCalendarQuery(await searchParams, today)
  const range = calendarRange(query)
  return (
    <>
      <PageHeader
        title="Calendrier"
        description="Les sorties des films et séries demandés sur le serveur, et celles de tes abonnements."
        actions={<SubscriptionsButton subscriptions={listSubscriptions(viewer.id)} />}
      />
      <CalendarToolbar query={query} range={range} today={today} />
      <Suspense key={`${query.view}|${range.from}|${query.type}|${query.mine}`} fallback={<CalendarSkeleton view={query.view} days={range.days.length} />}>
        <CalendarBody query={query} range={range} today={today} viewer={viewer} />
      </Suspense>
    </>
  )
}
