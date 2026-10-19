import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CatalogGrid } from '@/components/media/CatalogGrid'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { getViewer } from '@/lib/auth/viewer'
import { errorMessage } from '@/lib/http'
import { BackIcon, WarningIcon } from '@/lib/icons'
import { loadCatalog } from '@/lib/requests/catalog'
import { mediaHref } from '@/lib/requests/format'
import { getTmdb } from '@/lib/services/tmdb/client'
import type { MediaType } from '@/lib/services/tmdb/types'

type Params = Promise<{ type: string; id: string; relation: string }>

const TYPES: Record<string, MediaType> = { film: 'movie', serie: 'tv' }
const RELATIONS = { similaires: 'similar', recommandations: 'recommendations' } as const

export const metadata: Metadata = { title: 'Titres liés' }

/** « Tout voir » des rangées de la fiche : recommandations ou titres similaires, en grille infinie. */
export default async function RelatedPage({ params }: { params: Params }) {
  const viewer = await getViewer()
  const { type, id, relation: slug } = await params
  const mediaType = TYPES[type]
  const tmdbId = Number(id)
  const relation = RELATIONS[slug as keyof typeof RELATIONS]
  if (!mediaType || !relation || !Number.isInteger(tmdbId) || tmdbId <= 0) notFound()

  const source = { kind: 'related' as const, relation, mediaType, tmdbId }
  const result = await Promise.all([getTmdb().details(mediaType, tmdbId), loadCatalog(source, 1, viewer)]).then(
    ([media, initial]) => ({ ok: true as const, media, initial }),
    (error: unknown) => ({ ok: false as const, error }),
  )
  if (!result.ok) return <EmptyState icon={WarningIcon} title="Cette liste ne répond pas" description={errorMessage(result.error)} />

  const title = result.media.title ?? result.media.name ?? 'ce titre'
  return (
    <>
      <Link href={mediaHref(mediaType, tmdbId)} className="mb-4 inline-flex min-h-11 items-center gap-2 text-subhead font-medium text-text-secondary hover:text-text">
        <BackIcon size={16} aria-hidden />
        {title}
      </Link>
      <PageHeader title={relation === 'similar' ? 'Titres similaires' : 'Recommandations'} description={`À partir de « ${title} ».`} />
      <CatalogGrid source={source} initial={result.initial} emptyTitle="Rien pour l'instant" emptyDescription="TMDB n'a pas encore de suggestion pour ce titre." />
    </>
  )
}
