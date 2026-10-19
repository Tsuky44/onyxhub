import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { MediaCard } from '@/components/media/MediaCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { getViewer } from '@/lib/auth/viewer'
import { errorMessage, ServiceError } from '@/lib/http'
import { WarningIcon } from '@/lib/icons'
import { withStatus } from '@/lib/requests/catalog'
import { getTmdb } from '@/lib/services/tmdb/client'
import type { TmdbCollection } from '@/lib/services/tmdb/types'
import { tmdbImageUrl } from '@/lib/tmdb-image'

type Params = Promise<{ id: string }>

const collection = cache((id: number) => getTmdb().collection(id))

function parseId(raw: string): number {
  const id = Number(raw)
  if (!Number.isInteger(id) || id <= 0) notFound()
  return id
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  try {
    return { title: (await collection(parseId((await params).id))).name }
  } catch {
    return { title: 'Collection' }
  }
}

/** Une saga : ses films dans l'ordre de sortie, chacun avec son statut. */
export default async function CollectionPage({ params }: { params: Params }) {
  await getViewer()
  const id = parseId((await params).id)
  let data: TmdbCollection
  try {
    data = await collection(id)
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) notFound()
    return <EmptyState icon={WarningIcon} title="Cette collection ne répond pas" description={errorMessage(error)} />
  }

  const parts = [...data.parts].sort((a, b) => (a.release_date || '9999').localeCompare(b.release_date || '9999'))
  const items = await withStatus(parts, 'movie')
  const backdrop = tmdbImageUrl(data.backdrop_path, 'w1280')
  const available = items.filter((item) => item.status === 'available').length

  return (
    <article className="flex flex-col gap-10">
      <header className="relative -mx-5 -mt-6 shell:-mx-12 shell:-mt-10 xl:-mx-20">
        <div className="absolute inset-0 overflow-hidden">
          {backdrop && <Image src={backdrop} alt="" fill priority sizes="100vw" className="object-cover opacity-45" />}
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/75 to-bg/20" />
        </div>
        <div className="relative flex flex-col gap-3 px-5 pt-32 pb-6 shell:px-12 shell:pt-44 xl:px-20">
          <p className="text-footnote font-semibold tracking-wide text-text-muted uppercase">Collection</p>
          <h1 className="text-display font-bold tracking-[-0.02em] text-balance text-text shell:text-hero">{data.name}</h1>
          <p className="text-callout text-text-secondary">
            {items.length} film{items.length > 1 ? 's' : ''} · {available} disponible{available > 1 ? 's' : ''}
          </p>
          {data.overview && <p className="max-w-3xl text-callout leading-relaxed text-pretty text-text-secondary">{data.overview}</p>}
        </div>
      </header>

      <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 shell:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
        {items.map((item) => (
          <li key={item.tmdbId}>
            <MediaCard item={item} />
          </li>
        ))}
      </ul>
    </article>
  )
}
