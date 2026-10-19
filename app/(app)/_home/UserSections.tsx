import Link from 'next/link'
import { MediaRail } from '@/components/media/MediaRail'
import { Poster } from '@/components/media/Poster'
import { Badge, RequestStatusBadge } from '@/components/media/StatusBadge'
import { Panel, PanelError, ProgressBar } from '@/components/ui/Panel'
import type { Viewer } from '@/lib/auth/viewer'
import { localDay, RELEASE_KIND_LABELS } from '@/lib/calendar/releases'
import { upcoming, type UpcomingRelease } from '@/lib/calendar/upcoming'
import { settle } from '@/lib/home/admin'
import { homeRequests, type HomeRequest } from '@/lib/home/requests'
import { RequestIcon, SearchIcon } from '@/lib/icons'
import { loadCatalog } from '@/lib/requests/catalog'
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
          {request.progress !== null && <ProgressBar value={request.progress} label={`Téléchargement de ${request.title}`} />}
        </span>
      </Link>
    </li>
  )
}

export async function MyRequests({ viewer }: { viewer: Viewer }) {
  const requests = await homeRequests({ viewer: viewer.name, owner: 'mine' }, 6)
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
        <ul className="flex flex-col gap-4">
          {requests.map((request) => (
            <RequestRow key={request.ids.join('-')} request={request} />
          ))}
        </ul>
      )}
    </Panel>
  )
}

const DAY = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

function dayLabel(date: string, today: string, tomorrow: string): string {
  if (date === today) return 'Aujourd\'hui'
  if (date === tomorrow) return 'Demain'
  const label = DAY.format(new Date(`${date}T12:00:00`))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function ReleaseRow({ release }: { release: UpcomingRelease }) {
  const content = (
    <>
      <Poster path={release.posterPath} title={release.title} sizes="36px" source="w185" compact className="w-9 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-subhead font-semibold text-text">{release.title}</span>
        <span className="block truncate text-footnote text-text-muted">{release.subtitle ?? RELEASE_KIND_LABELS[release.kind]}</span>
      </span>
      {release.hasFile ? <Badge label="Disponible" tone="success" /> : release.mine ? <Badge label="Ta demande" tone="accent" /> : null}
    </>
  )
  const className = 'flex items-center gap-3 rounded-card p-2 -m-2'
  return (
    <li>
      {release.tmdbId ? (
        <Link href={mediaHref(release.mediaType, release.tmdbId)} className={`${className} transition-colors duration-(--motion-micro) ease-onyx hover:bg-glass-fill`}>
          {content}
        </Link>
      ) : (
        <div className={className}>{content}</div>
      )}
    </li>
  )
}

export async function UpcomingReleases({ viewer, now }: { viewer: Viewer; now: Date }) {
  const result = await settle(() => upcoming(14, viewer.name, now))
  if (!result.ok) {
    return (
      <Panel title="Prochaines sorties" href="/calendrier" hrefLabel="Calendrier">
        <PanelError message={result.message} />
      </Panel>
    )
  }
  // Les miennes d'abord à date égale, et pas plus de 8 lignes : le calendrier montre le reste.
  const releases = result.value.slice(0, 8)
  const byDay = new Map<string, UpcomingRelease[]>()
  for (const release of releases) byDay.set(release.date, [...(byDay.get(release.date) ?? []), release])
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)

  return (
    <Panel title="Prochaines sorties" href="/calendrier" hrefLabel="Calendrier">
      {releases.length === 0 ? (
        <p className="text-body text-text-secondary">Rien de prévu dans les deux prochaines semaines.</p>
      ) : (
        <div className="flex flex-col gap-5">
          {[...byDay].map(([date, items]) => (
            <div key={date}>
              <h3 className="mb-2 text-footnote font-semibold text-text-secondary">{dayLabel(date, localDay(now), localDay(tomorrow))}</h3>
              <ul className="flex flex-col gap-3">
                {[...items]
                  .sort((a, b) => Number(b.mine) - Number(a.mine))
                  .map((release) => (
                    <ReleaseRow key={release.id} release={release} />
                  ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}

export async function ForYou({ viewer }: { viewer: Viewer }) {
  const result = await settle(() => loadCatalog({ kind: 'discover', query: { view: 'pour-toi', query: '', filters: {} } }, 1, viewer))
  // Sans TMDB, la rangée disparaît simplement : l'accueil n'est pas la page pour le signaler.
  if (!result.ok) return null
  return <MediaRail title="Pour toi" href="/demandes?vue=pour-toi" items={result.value.items.slice(0, 20)} />
}
