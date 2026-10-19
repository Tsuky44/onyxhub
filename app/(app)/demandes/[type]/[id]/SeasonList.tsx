'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { AvailabilityBadge, Badge } from '@/components/media/StatusBadge'
import { Poster } from '@/components/media/Poster'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { AutoSearchIcon, ChevronDownIcon, InteractiveSearchIcon, RequestIcon } from '@/lib/icons'
import { formatRuntime } from '@/lib/requests/format'
import type { SeasonEpisode } from '@/lib/requests/media-tools'
import type { SeasonRow } from '@/lib/requests/media-page'
import { tmdbImageUrl } from '@/lib/tmdb-image'
import { requestMediaAction } from '../../actions'
import { automaticSearchAction, loadSeasonAction } from './actions'
import { ReleaseSearch } from './ReleaseSearch'
import { isRequestable } from './RequestControl'

const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

function airDate(date: string | null): string | null {
  if (!date) return null
  const parsed = new Date(`${date}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : DATE.format(parsed)
}

function EpisodeState({ episode }: { episode: SeasonEpisode }) {
  if (episode.hasFile) return <Badge label="Disponible" tone="success" />
  const upcoming = !episode.airDate || new Date(`${episode.airDate}T00:00:00`) > new Date()
  if (upcoming) return <Badge label="À venir" tone="neutral" />
  if (episode.hasFile === false) return <Badge label="Manquant" tone="warning" />
  return null
}

type Search = { scope: { seasonNumber?: number; episodeId?: number }; label: string }

function Season({
  season,
  tmdbId,
  tvdbId,
  title,
  canRequest,
  isAdmin,
  onSearch,
}: {
  season: SeasonRow
  tmdbId: number
  tvdbId: number | null
  title: string
  canRequest: boolean
  isAdmin: boolean
  onSearch: (search: Search) => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [episodes, setEpisodes] = useState<SeasonEpisode[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, startLoading] = useTransition()
  const [requesting, startRequest] = useTransition()
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null)
  const panelId = `saison-${season.seasonNumber}`
  const tracked = season.status !== 'unknown' || season.requested

  function toggle() {
    const next = !open
    setOpen(next)
    if (next && !episodes) {
      startLoading(async () => {
        const result = await loadSeasonAction(tmdbId, season.seasonNumber, tvdbId)
        if (result.ok) setEpisodes(result.value)
        else setError(result.message)
      })
    }
  }

  return (
    <li className="rounded-panel border border-glass-border bg-surface">
      <div className="flex items-center gap-3 p-3 shell:gap-4">
        <button type="button" onClick={toggle} aria-expanded={open} aria-controls={panelId} className="flex min-w-0 flex-1 items-center gap-3 text-left shell:gap-4">
          <Poster path={season.posterPath} title={season.name} sizes="56px" source="w185" compact className="w-12 shrink-0 shell:w-14" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-callout font-semibold text-text">{season.name}</span>
            <span className="block text-footnote text-text-muted">
              {season.episodeCount} épisode{season.episodeCount > 1 ? 's' : ''}
              {season.year ? ` · ${season.year}` : ''}
            </span>
          </span>
          {season.status !== 'unknown' ? (
            <AvailabilityBadge status={season.status} className="hidden sm:inline-flex" />
          ) : season.requested ? (
            <Badge label="Demandé" tone="warning" className="hidden sm:inline-flex" />
          ) : null}
          <ChevronDownIcon size={18} aria-hidden className={cn('shrink-0 text-text-muted transition-transform duration-(--motion-standard) ease-onyx', open && 'rotate-180')} />
        </button>
        {canRequest && isRequestable(season) && (
          <Button
            variant="secondary"
            pending={requesting}
            aria-label={`Demander ${season.name}`}
            onClick={() =>
              startRequest(async () => {
                const result = await requestMediaAction('tv', tmdbId, [season.seasonNumber])
                setFeedback(result)
                if (result.ok) router.refresh()
              })
            }
          >
            <RequestIcon size={16} aria-hidden />
            <span className="hidden sm:inline">Demander</span>
          </Button>
        )}
      </div>
      {feedback && (
        <p role="status" className={cn('px-4 pb-3 text-footnote', feedback.ok ? 'text-success' : 'text-error')}>
          {feedback.message}
        </p>
      )}

      {open && (
        <div id={panelId} className="border-t border-glass-border px-3 pt-2 pb-3 shell:px-4">
          {isAdmin && tracked && (
            <div className="flex flex-wrap gap-2 py-2">
              <Button
                variant="ghost"
                onClick={() =>
                  startRequest(async () => {
                    const result = await automaticSearchAction('tv', tmdbId, season.seasonNumber, tvdbId)
                    setFeedback(result.ok ? { ok: true, message: result.value } : result)
                  })
                }
              >
                <AutoSearchIcon size={16} aria-hidden />
                Recherche auto de la saison
              </Button>
              <Button variant="ghost" onClick={() => onSearch({ scope: { seasonNumber: season.seasonNumber }, label: `${title} · ${season.name}` })}>
                <InteractiveSearchIcon size={16} aria-hidden />
                Recherche interactive
              </Button>
            </div>
          )}
          {loading && (
            <ul aria-hidden className="flex flex-col gap-3 py-2">
              {Array.from({ length: Math.min(season.episodeCount || 4, 6) }, (_, index) => (
                <li key={index} className="h-16 animate-pulse rounded-card bg-elevated" />
              ))}
            </ul>
          )}
          {error && <p className="py-4 text-body text-text-secondary">{error}</p>}
          {episodes && (
            <ul className="flex flex-col divide-y divide-glass-border">
              {episodes.map((episode) => {
                const still = tmdbImageUrl(episode.stillPath, 'w300')
                const meta = [airDate(episode.airDate), formatRuntime(episode.runtime)].filter(Boolean).join(' · ')
                return (
                  <li key={episode.episodeNumber} className="flex gap-3 py-3 shell:gap-4">
                    <div className="relative hidden aspect-video w-36 shrink-0 overflow-hidden rounded-card bg-elevated sm:block">
                      {still && <Image src={still} alt="" fill sizes="144px" className="object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="text-subhead font-semibold text-text">
                          <span className="font-mono text-text-muted">{episode.episodeNumber}.</span> {episode.name}
                        </p>
                        <EpisodeState episode={episode} />
                      </div>
                      {meta && <p className="mt-0.5 text-footnote text-text-muted">{meta}</p>}
                      {episode.overview && <p className="mt-1 line-clamp-2 text-footnote text-pretty text-text-secondary">{episode.overview}</p>}
                    </div>
                    {isAdmin && episode.sonarrEpisodeId && (
                      <button
                        type="button"
                        aria-label={`Recherche interactive de l'épisode ${episode.episodeNumber}`}
                        onClick={() =>
                          onSearch({ scope: { episodeId: episode.sonarrEpisodeId ?? undefined }, label: `${title} · S${season.seasonNumber}E${episode.episodeNumber}` })
                        }
                        className="flex size-11 shrink-0 items-center justify-center self-center rounded-full text-text-muted transition-colors duration-(--motion-micro) ease-onyx hover:bg-glass-fill hover:text-text"
                      >
                        <InteractiveSearchIcon size={18} aria-hidden />
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </li>
  )
}

/** Les saisons d'une série : statut, demande par saison, épisodes à la demande, outils admin. */
export function SeasonList({
  seasons,
  tmdbId,
  tvdbId,
  title,
  canRequest,
  isAdmin,
}: {
  seasons: SeasonRow[]
  tmdbId: number
  tvdbId: number | null
  title: string
  canRequest: boolean
  isAdmin: boolean
}) {
  const [search, setSearch] = useState<Search | null>(null)
  return (
    <section aria-labelledby="saisons">
      <h2 id="saisons" className="mb-4 text-title3 font-bold text-text">
        Saisons
      </h2>
      <ul className="flex flex-col gap-3">
        {seasons.map((season) => (
          <Season key={season.seasonNumber} season={season} tmdbId={tmdbId} tvdbId={tvdbId} title={title} canRequest={canRequest} isAdmin={isAdmin} onSearch={setSearch} />
        ))}
      </ul>
      {isAdmin && (
        <ReleaseSearch
          open={search !== null}
          onClose={() => setSearch(null)}
          mediaType="tv"
          tmdbId={tmdbId}
          tvdbId={tvdbId}
          scope={search?.scope ?? {}}
          label={search?.label ?? title}
        />
      )}
    </section>
  )
}
