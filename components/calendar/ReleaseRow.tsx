import Link from 'next/link'
import { Poster } from '@/components/media/Poster'
import { Badge } from '@/components/media/StatusBadge'
import { cn } from '@/lib/cn'
import { RELEASE_KIND_LABELS } from '@/lib/calendar/releases'
import type { UpcomingRelease } from '@/lib/calendar/upcoming'
import { mediaHref } from '@/lib/requests/format'

/** « S02E05 · Titre » pour un épisode, « En numérique » pour un film. */
export function releaseSubtitle(release: UpcomingRelease): string {
  return release.subtitle ?? RELEASE_KIND_LABELS[release.kind]
}

/** Un seul badge, le plus utile : le fichier est là, sinon c'est ma demande, sinon mon abonnement. */
export function ReleaseBadge({ release, className }: { release: UpcomingRelease; className?: string }) {
  if (release.hasFile) return <Badge label="Disponible" tone="success" className={className} />
  if (release.mine) return <Badge label="Ta demande" tone="accent" className={className} />
  if (release.subscribed) return <Badge label="Abonné" tone="neutral" className={className} />
  return null
}

/**
 * Une sortie en ligne (accueil, liste et jour choisi du calendrier) : affiche,
 * titre, épisode ou type de sortie, badge. Sans dépendance serveur.
 */
export function ReleaseRow({ release, size = 'sm' }: { release: UpcomingRelease; size?: 'sm' | 'md' }) {
  const content = (
    <>
      <Poster
        path={release.posterPath}
        title={release.title}
        sizes={size === 'md' ? '48px' : '36px'}
        source="w185"
        compact
        className={cn('shrink-0', size === 'md' ? 'w-12' : 'w-9')}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-subhead font-semibold text-text">{release.title}</span>
        <span className="block truncate text-footnote text-text-muted">{releaseSubtitle(release)}</span>
      </span>
      <ReleaseBadge release={release} />
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
