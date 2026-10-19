import Link from 'next/link'
import { StarIcon } from '@/lib/icons'
import type { CatalogItem } from '@/lib/requests/catalog'
import { mediaHref } from '@/lib/requests/format'
import { AvailabilityBadge } from './StatusBadge'
import { Poster } from './Poster'

/** Les largeurs d'une carte selon la grille (2 colonnes en téléphone, jusqu'à 7 en grand écran). */
export const CARD_SIZES = '(min-width: 1440px) 190px, (min-width: 1280px) 15vw, (min-width: 900px) 20vw, (min-width: 640px) 30vw, 45vw'

/**
 * Une carte de catalogue : l'affiche porte tout, le texte reste discret.
 * Composant sans état : il s'affiche aussi bien depuis le serveur que dans
 * la grille à défilement infini.
 */
export function MediaCard({ item, sizes = CARD_SIZES, priority = false }: { item: Omit<CatalogItem, 'status'> & Partial<Pick<CatalogItem, 'status'>>; sizes?: string; priority?: boolean }) {
  return (
    <Link href={mediaHref(item.mediaType, item.tmdbId)} className="group relative flex min-w-0 flex-col gap-2 rounded-card outline-offset-4">
      <div className="relative overflow-hidden rounded-card border border-glass-border">
        <Poster
          path={item.posterPath}
          title={item.title}
          sizes={sizes}
          priority={priority}
          className="rounded-none transition-transform duration-(--motion-emphasis) ease-onyx group-hover:scale-105"
        />
        {item.status && <AvailabilityBadge status={item.status} overlay className="absolute top-2 left-2" />}
      </div>
      <div className="min-w-0 px-0.5">
        <p className="truncate text-subhead font-semibold text-text">{item.title}</p>
        <p className="flex items-center gap-1.5 text-footnote text-text-muted">
          <span>{item.mediaType === 'movie' ? 'Film' : 'Série'}</span>
          {item.year && <span aria-hidden>·</span>}
          {item.year && <span className="font-mono">{item.year}</span>}
          {item.rating ? (
            <span className="ml-auto inline-flex items-center gap-0.5 font-mono">
              <StarIcon size={11} weight="fill" className="text-rating" aria-hidden />
              <span className="sr-only">Note</span>
              {item.rating.toFixed(1)}
            </span>
          ) : null}
        </p>
      </div>
    </Link>
  )
}

export function MediaGridSkeleton({ count = 14 }: { count?: number }) {
  return (
    <div aria-hidden className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 shell:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex flex-col gap-2">
          <div className="aspect-[2/3] animate-pulse rounded-card bg-elevated" />
          <div className="h-3.5 w-3/4 animate-pulse rounded-full bg-elevated" />
        </div>
      ))}
    </div>
  )
}
