import Link from 'next/link'
import { LiveRequestDownloads, RequestDownloadBar } from '@/components/media/LiveRequestDownloads'
import { MediaRail } from '@/components/media/MediaRail'
import { Poster } from '@/components/media/Poster'
import { RequestStatusBadge } from '@/components/media/StatusBadge'
import { Panel, PanelError } from '@/components/ui/Panel'
import type { Viewer } from '@/lib/auth/viewer'
import { MonthSkeleton, MonthView } from '@/components/calendar/MonthView'
import { calendarRange, parseCalendarQuery } from '@/lib/calendar/query'
import { calendarData } from '@/lib/calendar/upcoming'
import { settle } from '@/lib/home/admin'
import { homeRequestsWithDownloads, type HomeRequest } from '@/lib/home/requests'
import { ChevronRightIcon, RequestIcon, SearchIcon } from '@/lib/icons'
import { loadCatalog } from '@/lib/requests/catalog'
import { groupKey } from '@/lib/requests/download-targets'
import { formatRelative, formatSeasons, mediaHref } from '@/lib/requests/format'

/** La recherche de l'accueil : un simple formulaire vers la découverte, sans script. */
export function HomeSearch() {
  return (
    <form action="/demandes" role="search" className="relative w-full max-w-xl">
      <SearchIcon size={18} aria-hidden className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-text-muted" />
      <input
        type="search"
        name="q"
        placeholder="Chercher un film ou une série à demander…"
        aria-label="Chercher un film ou une série"
        enterKeyHint="search"
        className="min-h-12 w-full rounded-full border border-border bg-elevated pr-4 pl-11 text-callout text-text placeholder:text-text-muted outline-none transition-colors duration-(--motion-micro) ease-onyx hover:border-text-muted focus:border-accent"
      />
    </form>
  )
}

export function RequestRow({ request, showRequester = false }: { request: HomeRequest; showRequester?: boolean }) {
  return (
    <li>
      <Link href={mediaHref(request.mediaType, request.tmdbId)} className="flex items-center gap-3 rounded-card p-2 -m-2 transition-colors duration-(--motion-micro) ease-onyx hover:bg-glass-fill">
        <Poster path={request.posterPath} title={request.title} sizes="44px" source="w185" compact className="w-11 shrink-0" />
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex items-center justify-between gap-2">
            <span className="truncate text-subhead font-semibold text-text">{request.title}</span>
            <RequestStatusBadge status={request.status} />
          </span>
          <span className="truncate text-footnote text-text-muted">
            {request.mediaType === 'movie' ? 'Film' : formatSeasons(request.seasons) || 'Série'}
            {showRequester ? ` · ${request.requester}` : ''} · {formatRelative(new Date(request.requestedAt))}
          </span>
          <RequestDownloadBar downloadKey={groupKey(request)} title={request.title} />
        </span>
      </Link>
    </li>
  )
}

export async function MyRequests({ viewer }: { viewer: Viewer }) {
  const { requests, downloads } = await homeRequestsWithDownloads({ viewer: viewer.name, owner: 'mine' }, 6)
  return (
    <Panel title="Mes demandes" href={requests.length > 0 ? '/demandes/liste?demandeur=moi' : undefined}>
      {requests.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-body text-text-secondary">Tu n&apos;as encore rien demandé.</p>
          {viewer.canRequest && (
            <Link href="/demandes" className="inline-flex min-h-11 items-center gap-2 rounded-card bg-primary-fill px-4 text-subhead font-semibold text-on-primary hover:bg-text">
              <RequestIcon size={18} aria-hidden />
              Trouver quelque chose
            </Link>
          )}
        </div>
      ) : (
        <LiveRequestDownloads groups={requests} initial={downloads}>
          <ul className="flex flex-col gap-4">
            {requests.map((request) => (
              <RequestRow key={request.ids.join('-')} request={request} />
            ))}
          </ul>
        </LiveRequestDownloads>
      )}
    </Panel>
  )
}

function CalendarHeading() {
  return (
    <div className="mb-4 flex min-h-8 items-center justify-between gap-3">
      <h2 id="accueil-calendrier" className="text-headline font-semibold text-text">
        Sorties du mois
      </h2>
      <Link href="/calendrier" className="-my-2 inline-flex min-h-11 shrink-0 items-center gap-1 text-subhead font-medium text-text-secondary hover:text-text">
        Calendrier
        <ChevronRightIcon size={14} aria-hidden />
      </Link>
    </div>
  )
}

function monthRange(today: string) {
  return calendarRange(parseCalendarQuery({}, today))
}

export function HomeCalendarSkeleton({ today }: { today: string }) {
  return (
    <section aria-labelledby="accueil-calendrier" className="min-w-0">
      <CalendarHeading />
      <MonthSkeleton days={monthRange(today).days.length} />
    </section>
  )
}

/**
 * Le mois en cours au cœur de l'accueil, comme MediaHub : c'est ce qu'on
 * vient voir. Les vues semaine et liste, les filtres et les abonnements
 * restent sur /calendrier.
 */
export async function HomeCalendar({ viewer, today }: { viewer: Viewer; today: string }) {
  const range = monthRange(today)
  const result = await settle(() => calendarData(range.from, range.to, viewer))
  return (
    <section aria-labelledby="accueil-calendrier" className="min-w-0">
      <CalendarHeading />
      {!result.ok ? (
        <div className="rounded-panel border border-glass-border bg-surface p-5">
          <PanelError message={result.message} />
        </div>
      ) : (
        <>
          {result.value.unavailable.length > 0 && (
            <p role="status" className="mb-4 text-footnote text-warning">
              {result.value.unavailable.join(' et ')} ne répond pas : des sorties manquent.
            </p>
          )}
          <MonthView days={range.days} month={today.slice(0, 7)} today={today} releases={result.value.releases} />
        </>
      )}
    </section>
  )
}

export async function ForYou({ viewer }: { viewer: Viewer }) {
  const result = await settle(() => loadCatalog({ kind: 'discover', query: { view: 'pour-toi', query: '', filters: {} } }, 1, viewer))
  // Sans TMDB, la rangée disparaît simplement : l'accueil n'est pas la page pour le signaler.
  if (!result.ok) return null
  return <MediaRail title="Pour toi" href="/demandes?vue=pour-toi" items={result.value.items.slice(0, 20)} />
}
