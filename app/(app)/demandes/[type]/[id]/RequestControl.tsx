'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { AvailabilityBadge } from '@/components/media/StatusBadge'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { cn } from '@/lib/cn'
import { CheckIcon, RequestIcon } from '@/lib/icons'
import type { SeasonRow } from '@/lib/requests/media-page'
import type { AvailabilityStatus } from '@/lib/requests/status'
import type { MediaType } from '@/lib/services/tmdb/types'
import { requestMediaAction } from '../../actions'

/** Une saison peut se demander si personne ne l'a fait et que Sonarr ne l'a ni ne la cherche. */
export function isRequestable(season: Pick<SeasonRow, 'status' | 'requested'>): boolean {
  return !season.requested && season.status === 'unknown'
}

const BUSY_LABELS: Partial<Record<AvailabilityStatus, string>> = {
  pending: 'Demandé',
  processing: 'En cours de téléchargement',
  partial: 'Partiellement disponible',
}

/**
 * Le bouton de demande de la fiche, avec son état. Pour une série, il ouvre
 * le choix des saisons (une ligne de demande par saison, comme MediaHub).
 */
export function RequestControl({
  mediaType,
  tmdbId,
  title,
  status,
  requested,
  seasons,
  canRequest,
}: {
  mediaType: MediaType
  tmdbId: number
  title: string
  status: AvailabilityStatus
  /** Une demande existe déjà (film). */
  requested: boolean
  seasons: SeasonRow[]
  canRequest: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null)
  const [open, setOpen] = useState(false)
  const requestable = seasons.filter(isRequestable)
  const regular = requestable.filter((season) => season.seasonNumber > 0)
  const [selected, setSelected] = useState<Set<number>>(new Set())

  function send(seasonNumbers?: number[]) {
    startTransition(async () => {
      const result = await requestMediaAction(mediaType, tmdbId, seasonNumbers)
      setFeedback(result)
      if (result.ok) {
        setOpen(false)
        router.refresh()
      }
    })
  }

  const feedbackLine = feedback && (
    <p role="status" className={cn('text-footnote', feedback.ok ? 'text-success' : 'text-error')}>
      {feedback.message}
    </p>
  )

  if (mediaType === 'movie') {
    if (status === 'available') return <AvailabilityBadge status="available" />
    if (status !== 'unknown' || requested) {
      return (
        <div className="flex flex-col gap-2">
          <Button variant="secondary" disabled>
            <CheckIcon size={16} aria-hidden />
            {BUSY_LABELS[status] ?? 'Demandé'}
          </Button>
          {feedbackLine}
        </div>
      )
    }
    if (!canRequest) return null
    return (
      <div className="flex flex-col gap-2">
        <Button pending={pending} onClick={() => send()}>
          <RequestIcon size={18} aria-hidden />
          Demander
        </Button>
        {feedbackLine}
      </div>
    )
  }

  // Série
  if (requestable.length === 0 || !canRequest) {
    return (
      <div className="flex flex-col gap-2">
        {status !== 'unknown' ? <AvailabilityBadge status={status} /> : null}
        {feedbackLine}
      </div>
    )
  }

  const anyRequested = seasons.some((season) => !isRequestable(season))
  const allRegularSelected = regular.length > 0 && regular.every((season) => selected.has(season.seasonNumber))

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => {
            setSelected(new Set(regular.map((season) => season.seasonNumber)))
            setOpen(true)
          }}
        >
          <RequestIcon size={18} aria-hidden />
          {anyRequested ? 'Demander d\'autres saisons' : 'Demander'}
        </Button>
        {status !== 'unknown' && <AvailabilityBadge status={status} />}
      </div>
      {feedbackLine}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Quelles saisons ?"
        description={`Chaque saison de « ${title} » devient une demande, suivie à part.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button pending={pending} disabled={selected.size === 0} onClick={() => send([...selected].sort((a, b) => a - b))}>
              {selected.size > 1 ? `Demander ${selected.size} saisons` : 'Demander la saison'}
            </Button>
          </>
        }
      >
        {regular.length > 1 && (
          <label className="mb-2 flex min-h-11 cursor-pointer items-center gap-3 rounded-card px-3 text-body font-semibold hover:bg-glass-fill">
            <input
              type="checkbox"
              checked={allRegularSelected}
              onChange={() => setSelected(allRegularSelected ? new Set() : new Set(regular.map((season) => season.seasonNumber)))}
              className="size-4 accent-accent"
            />
            Toutes les saisons disponibles à la demande
          </label>
        )}
        <ul className="flex flex-col">
          {seasons.map((season) => {
            const available = isRequestable(season)
            return (
              <li key={season.seasonNumber}>
                <label
                  className={cn(
                    'flex min-h-12 items-center gap-3 rounded-card px-3 py-2',
                    available ? 'cursor-pointer hover:bg-glass-fill' : 'opacity-60',
                  )}
                >
                  <input
                    type="checkbox"
                    disabled={!available}
                    checked={available && selected.has(season.seasonNumber)}
                    onChange={() =>
                      setSelected((previous) => {
                        const next = new Set(previous)
                        if (next.has(season.seasonNumber)) next.delete(season.seasonNumber)
                        else next.add(season.seasonNumber)
                        return next
                      })
                    }
                    className="size-4 accent-accent"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-medium text-text">{season.name}</span>
                    <span className="block text-footnote text-text-muted">
                      {season.episodeCount} épisode{season.episodeCount > 1 ? 's' : ''}
                      {season.year ? ` · ${season.year}` : ''}
                    </span>
                  </span>
                  {!available && (season.status !== 'unknown' ? <AvailabilityBadge status={season.status} /> : <AvailabilityBadge status="pending" />)}
                </label>
              </li>
            )
          })}
        </ul>
      </Dialog>
    </div>
  )
}
