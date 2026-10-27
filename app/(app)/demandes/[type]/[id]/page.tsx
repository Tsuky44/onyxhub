import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { MediaRail } from '@/components/media/MediaRail'
import { Poster } from '@/components/media/Poster'
import { AvailabilityBadge } from '@/components/media/StatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { getViewer, type Viewer } from '@/lib/auth/viewer'
import { errorMessage, NotConfiguredError, ServiceError } from '@/lib/http'
import { buttonClasses } from '@/components/ui/Button'
import { PlayIcon, StarIcon, WarningIcon } from '@/lib/icons'
import { formatRuntime, mediaHref, yearOf } from '@/lib/requests/format'
import { loadMediaPage } from '@/lib/requests/media-page'
import { getTmdb } from '@/lib/services/tmdb/client'
import type { MediaType } from '@/lib/services/tmdb/types'
import { tmdbImageUrl } from '@/lib/tmdb-image'
import { sorraaConfigured } from '@/lib/services/sorraa/client'
import { waitingText } from '@/lib/requests/waiting'
import { AdminTools } from './AdminTools'
import { DownloadPanel } from './DownloadPanel'
import { SubscribeButton, TrailerButton, WatchLaterButton } from './MediaButtons'
import { CastRail, CollectionCard, Facts, Overview } from './MediaSections'
import { RequestControl } from './RequestControl'
import { SeasonList } from './SeasonList'

type Params = Promise<{ type: string; id: string }>

const TYPES: Record<string, MediaType> = { film: 'movie', serie: 'tv' }

function parseParams({ type, id }: { type: string; id: string }): { mediaType: MediaType; tmdbId: number } {
  const mediaType = TYPES[type]
  const tmdbId = Number(id)
  if (!mediaType || !Number.isInteger(tmdbId) || tmdbId <= 0) notFound()
  return { mediaType, tmdbId }
}

// Le titre de l'onglet et la page lisent la même fiche : un seul appel TMDB (et il est en cache 6 h).
const details = cache((mediaType: MediaType, tmdbId: number) => getTmdb().details(mediaType, tmdbId))

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { mediaType, tmdbId } = parseParams(await params)
  try {
    const media = await details(mediaType, tmdbId)
    return { title: media.title ?? media.name ?? 'Fiche' }
  } catch {
    return { title: 'Fiche' }
  }
}

async function load(mediaType: MediaType, tmdbId: number, viewer: Viewer) {
  try {
    await details(mediaType, tmdbId)
    return { ok: true as const, data: await loadMediaPage(mediaType, tmdbId, viewer) }
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) notFound()
    return { ok: false as const, error }
  }
}

export default async function MediaPage({ params }: { params: Params }) {
  const viewer = await getViewer()
  const { mediaType, tmdbId } = parseParams(await params)
  const result = await load(mediaType, tmdbId, viewer)

  if (!result.ok) {
    const notConfigured = result.error instanceof NotConfiguredError
    return (
      <EmptyState
        icon={WarningIcon}
        title={notConfigured ? 'TMDB n\'est pas encore branché' : 'Cette fiche ne répond pas'}
        description={notConfigured ? 'Un administrateur doit ajouter une clé TMDB dans Réglages.' : errorMessage(result.error)}
      />
    )
  }

  const { data } = result
  const media = data.details
  const title = media.title ?? media.name ?? 'Sans titre'
  const year = yearOf(media.release_date ?? media.first_air_date)
  const runtime = mediaType === 'movie' ? formatRuntime(media.runtime) : formatRuntime(media.episode_run_time?.[0])
  const backdrop = tmdbImageUrl(media.backdrop_path, 'w1280')
  const meta = [
    year,
    mediaType === 'tv' && media.number_of_seasons ? `${media.number_of_seasons} saison${media.number_of_seasons > 1 ? 's' : ''}` : null,
    runtime,
    media.genres?.slice(0, 3).map((genre) => genre.name).join(', '),
  ].filter(Boolean)
  const inLibrary = data.availability.status !== 'unknown' || (mediaType === 'movie' ? false : data.availability.seasons.length > 0)
  const relatedBase = mediaHref(mediaType, tmdbId)

  return (
    <article className="flex flex-col gap-12">
      <header className="relative -mx-5 -mt-6 shell:-mx-12 shell:-mt-10 xl:-mx-20">
        <div className="absolute inset-0 overflow-hidden">
          {backdrop && <Image src={backdrop} alt="" fill priority sizes="100vw" className="object-cover object-top opacity-50" />}
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/80 to-bg/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-bg/90 via-bg/30 to-transparent" />
        </div>

        <div className="relative flex flex-col gap-6 px-5 pt-28 pb-6 shell:flex-row shell:items-end shell:gap-10 shell:px-12 shell:pt-40 xl:px-20">
          <Poster path={media.poster_path} title={title} sizes="(min-width: 900px) 240px, 160px" source="w500" priority className="w-40 shrink-0 border border-glass-border shadow-float shell:w-60" />

          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-footnote font-semibold tracking-wide text-text-muted uppercase">{mediaType === 'movie' ? 'Film' : 'Série'}</span>
              <AvailabilityBadge status={data.availability.status} />
            </div>
            <h1 className="text-display font-bold tracking-[-0.02em] text-balance text-text shell:text-hero">{title}</h1>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-callout text-text-secondary">
              {media.vote_average ? (
                <span className="inline-flex items-center gap-1 font-mono text-text">
                  <StarIcon size={14} weight="fill" className="text-rating" aria-hidden />
                  <span className="sr-only">Note TMDB :</span>
                  {media.vote_average.toFixed(1)}
                </span>
              ) : null}
              {meta.map((part) => (
                <span key={part}>{part}</span>
              ))}
            </p>
            {media.tagline && <p className="text-callout text-pretty text-text-muted italic">{media.tagline}</p>}

            <div className="flex flex-wrap items-start gap-3 pt-2">
              {data.onyxUrl && (
                <a href={data.onyxUrl} target="_blank" rel="noreferrer" className={buttonClasses('primary')}>
                  <PlayIcon size={18} weight="fill" aria-hidden />
                  Lire dans Onyx
                </a>
              )}
              <RequestControl
                mediaType={mediaType}
                tmdbId={tmdbId}
                title={title}
                status={data.availability.status}
                requested={data.requests.length > 0}
                seasons={data.seasons}
                canRequest={viewer.canRequest}
              />
              {data.trailer && <TrailerButton videoKey={data.trailer.key} title={title} />}
              <WatchLaterButton item={{ mediaType, tmdbId, title, posterPath: media.poster_path }} initial={data.inWatchLater} />
              {data.subscription.available && (
                <SubscribeButton item={{ mediaType, tmdbId, title, posterPath: media.poster_path }} initial={data.subscription.subscribed} />
              )}
            </div>

            {viewer.isAdmin && (
              <AdminTools
                mediaType={mediaType}
                tmdbId={tmdbId}
                tvdbId={data.tvdbId}
                title={title}
                status={data.availability.status}
                requests={data.requests}
                externalUrl={data.externalUrl}
                inLibrary={inLibrary || (sorraaConfigured() && data.requests.length > 0)}
                usesSorraa={sorraaConfigured()}
              />
            )}

            {data.waiting && <p className="text-callout text-warning">{waitingText(data.waiting)}</p>}

            <DownloadPanel
              mediaType={mediaType}
              tmdbId={tmdbId}
              tvdbId={data.tvdbId}
              initial={data.downloads}
              watching={data.availability.status === 'processing'}
            />
          </div>
        </div>
      </header>

      <div className="grid gap-8 shell:grid-cols-[minmax(0,1fr)_320px] shell:gap-12">
        <Overview details={media} crew={data.crew} />
        <Facts details={media} mediaType={mediaType} providers={data.providers} />
      </div>

      {mediaType === 'tv' && data.seasons.length > 0 && (
        <SeasonList seasons={data.seasons} tmdbId={tmdbId} tvdbId={data.tvdbId} title={title} canRequest={viewer.canRequest} isAdmin={viewer.isAdmin} usesSorraa={sorraaConfigured()} />
      )}

      {media.belongs_to_collection && <CollectionCard collection={media.belongs_to_collection} />}

      <CastRail cast={media.credits?.cast ?? []} />
      <MediaRail title="Recommandations" href={`${relatedBase}/recommandations`} items={data.recommendations} />
      <MediaRail title="Titres similaires" href={`${relatedBase}/similaires`} items={data.similar} />
    </article>
  )
}
