import Link from 'next/link'
import type { ReactNode } from 'react'
import { ChevronRightIcon } from '@/lib/icons'
import type { CatalogItem } from '@/lib/requests/catalog'
import { MediaCard } from './MediaCard'

/** Une rangée horizontale (similaires, recommandations, casting…) : défilement natif avec aimantation, sans script. */
export function Rail({ title, href, children }: { title: string; href?: string; children: ReactNode }) {
  return (
    <section className="min-w-0">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-title3 font-bold text-text">{title}</h2>
        {href && (
          <Link href={href} className="inline-flex min-h-11 items-center gap-1 text-subhead font-medium text-text-secondary hover:text-text">
            Tout voir
            <ChevronRightIcon size={14} aria-hidden />
          </Link>
        )}
      </div>
      <div className="scrollbar-none -mx-5 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-2 shell:-mx-12 shell:scroll-px-12 shell:px-12 xl:-mx-20 xl:scroll-px-20 xl:px-20">
        {children}
      </div>
    </section>
  )
}

export function MediaRail({ title, href, items }: { title: string; href?: string; items: readonly CatalogItem[] }) {
  if (items.length === 0) return null
  return (
    <Rail title={title} href={href}>
      {items.map((item) => (
        <div key={`${item.mediaType}:${item.tmdbId}`} className="w-32 shrink-0 snap-start shell:w-40">
          <MediaCard item={item} sizes="(min-width: 900px) 160px, 128px" />
        </div>
      ))}
    </Rail>
  )
}
