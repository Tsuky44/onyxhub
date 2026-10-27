'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { RequestStatusBadge } from '@/components/media/StatusBadge'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { cn } from '@/lib/cn'
import { AutoSearchIcon, ExternalIcon, InteractiveSearchIcon, ManageIcon, SearchIcon, TrashIcon } from '@/lib/icons'
import { formatRelative, formatSeasons } from '@/lib/requests/format'
import type { MediaRequestView } from '@/lib/requests/media-page'
import { AVAILABILITY_LABELS, type AvailabilityStatus } from '@/lib/requests/status'
import type { MediaType } from '@/lib/services/tmdb/types'
import { deleteRequestsAction } from '../../liste/actions'
import { automaticSearchAction, markAvailableAction, removeMediaAction, removeSeasonAction } from './actions'
import { ReleaseSearch } from './ReleaseSearch'

type Feedback = { ok: boolean; message: string } | null

/**
 * Les outils admin de la fiche, comme le « Gérer » de MediaHub : demandes
 * liées, statut Radarr/Sonarr, suppression, recherches automatique et
 * interactive.
 */
export function AdminTools({
  mediaType,
  tmdbId,
  tvdbId,
  title,
  status,
  requests,
  externalUrl,
  inLibrary,
  usesSorraa,
}: {
  mediaType: MediaType
  tmdbId: number
  tvdbId: number | null
  title: string
  status: AvailabilityStatus
  requests: MediaRequestView[]
  externalUrl: string | null
  inLibrary: boolean
  /** Les demandes passent par sorraa : une saison peut être retirée complètement. */
  usesSorraa: boolean
}) {
  const router = useRouter()
  const [manageOpen, setManageOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [deleteFiles, setDeleteFiles] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [pending, startTransition] = useTransition()
  const [seasonToRemove, setSeasonToRemove] = useState<number | null>(null)
  const service = usesSorraa ? 'sorraa' : mediaType === 'movie' ? 'Radarr' : 'Sonarr'

  function run(action: () => Promise<{ ok: true; value: string } | { ok: false; message: string } | { ok: boolean; message: string }>, refresh = true) {
    startTransition(async () => {
      const result = await action()
      setFeedback('value' in result ? { ok: true, message: result.value } : { ok: result.ok, message: result.message })
      if (result.ok && refresh) router.refresh()
    })
  }

  const feedbackLine = feedback && (
    <p role="status" className={cn('text-footnote', feedback.ok ? 'text-success' : 'text-error')}>
      {feedback.message}
    </p>
  )

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" onClick={() => setManageOpen(true)}>
          <ManageIcon size={18} aria-hidden />
          Gérer
        </Button>
        {(inLibrary || usesSorraa) && (
          <Button variant="ghost" pending={pending && !manageOpen} onClick={() => run(() => automaticSearchAction(mediaType, tmdbId, null, tvdbId), false)}>
            <AutoSearchIcon size={18} aria-hidden />
            Recherche auto
          </Button>
        )}
        {(inLibrary || usesSorraa) && mediaType === 'movie' && (
          <Button variant="ghost" onClick={() => setSearchOpen(true)}>
            <InteractiveSearchIcon size={18} aria-hidden />
            Recherche interactive
          </Button>
        )}
        {/* Hors Radarr/Sonarr (version introuvable, autre langue…) : la recherche libre dans tous les indexeurs. */}
        <Link
          href={`/telechargements/recherche?q=${encodeURIComponent(title)}`}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-card px-4 text-subhead font-semibold text-text-secondary transition-colors duration-(--motion-micro) ease-onyx hover:bg-glass-fill hover:text-text"
        >
          <SearchIcon size={18} aria-hidden />
          Prowlarr
        </Link>
      </div>
      {!manageOpen && feedbackLine}

      {mediaType === 'movie' && (
        <ReleaseSearch open={searchOpen} onClose={() => setSearchOpen(false)} mediaType="movie" tmdbId={tmdbId} tvdbId={null} scope={{}} label={title} />
      )}

      <Dialog open={manageOpen} onClose={() => setManageOpen(false)} title={`Gérer « ${title} »`} size="lg">
        <div className="flex flex-col gap-6">
          <section>
            <h3 className="mb-2 text-footnote font-semibold tracking-wide text-text-muted uppercase">{service}</h3>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-panel border border-glass-border bg-glass-fill px-4 py-3">
              <p className="text-body text-text">{inLibrary ? (AVAILABILITY_LABELS[status] ?? 'Dans la bibliothèque, non surveillé') : `Absent de ${service}`}</p>
              {externalUrl && (
                <a href={externalUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1.5 text-subhead font-medium text-accent-muted hover:text-text">
                  Ouvrir dans {service}
                  <ExternalIcon size={14} aria-hidden />
                </a>
              )}
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-footnote font-semibold tracking-wide text-text-muted uppercase">Demandes ({requests.length})</h3>
            {requests.length === 0 ? (
              <p className="text-body text-text-secondary">Personne n&apos;a demandé ce média.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-glass-border rounded-panel border border-glass-border">
                {requests.map((request) => (
                  <li key={request.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body font-medium text-text">
                        {request.seasonNumber !== null ? formatSeasons([request.seasonNumber]) : 'Film'}
                        <span className="font-normal text-text-secondary"> · {request.requester}</span>
                      </p>
                      <p className="text-footnote text-text-muted">{formatRelative(new Date(request.requestedAt))}</p>
                    </div>
                    <RequestStatusBadge status={request.status} />
                    <button
                      type="button"
                      disabled={pending}
                      aria-label={`Supprimer la demande de ${request.requester}`}
                      onClick={() => run(() => deleteRequestsAction([request.id]))}
                      className="flex size-11 items-center justify-center rounded-full text-text-muted transition-colors duration-(--motion-micro) ease-onyx hover:bg-glass-fill hover:text-error disabled:opacity-50"
                    >
                      <TrashIcon size={18} aria-hidden />
                    </button>
                    {usesSorraa && request.seasonNumber !== null && (
                      <button
                        type="button"
                        disabled={pending}
                        aria-label={`Retirer complètement la saison ${request.seasonNumber}`}
                        onClick={() => setSeasonToRemove(request.seasonNumber)}
                        className="min-h-11 rounded-full px-3 text-footnote font-medium text-text-muted transition-colors duration-(--motion-micro) ease-onyx hover:bg-glass-fill hover:text-error disabled:opacity-50"
                      >
                        Retirer la saison
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-footnote font-semibold tracking-wide text-text-muted uppercase">Actions</h3>
            <div className="flex flex-wrap gap-2">
              {requests.some((request) => request.status !== 'available') && (
                <Button variant="secondary" disabled={pending} onClick={() => run(() => markAvailableAction(mediaType, tmdbId))}>
                  Marquer comme disponible
                </Button>
              )}
              {inLibrary && !confirmRemove && (
                <Button variant="danger-quiet" onClick={() => setConfirmRemove(true)}>
                  <TrashIcon size={16} aria-hidden />
                  Retirer de {service}
                </Button>
              )}
            </div>
            {seasonToRemove !== null && (
              <div className="flex flex-col gap-3 rounded-panel border border-error/40 p-4">
                <p className="text-body text-text">
                  {service} ne cherchera plus la {formatSeasons([seasonToRemove]).toLowerCase()} de « {title} » et elle quittera les demandes.
                </p>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 text-body text-text-secondary">
                  <input type="checkbox" checked={deleteFiles} onChange={(event) => setDeleteFiles(event.target.checked)} className="size-4 accent-accent" />
                  Mettre aussi ses fichiers à la corbeille
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" onClick={() => setSeasonToRemove(null)}>
                    Annuler
                  </Button>
                  <Button
                    variant="danger"
                    pending={pending}
                    onClick={() =>
                      run(async () => {
                        const result = await removeSeasonAction(tmdbId, seasonToRemove, deleteFiles)
                        if (result.ok) setSeasonToRemove(null)
                        return result
                      })
                    }
                  >
                    Retirer la saison
                  </Button>
                </div>
              </div>
            )}
            {confirmRemove && (
              <div className="flex flex-col gap-3 rounded-panel border border-error/40 p-4">
                <p className="text-body text-text">
                  {service} oubliera « {title} » et ses demandes seront effacées.
                </p>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 text-body text-text-secondary">
                  <input type="checkbox" checked={deleteFiles} onChange={(event) => setDeleteFiles(event.target.checked)} className="size-4 accent-accent" />
                  Supprimer aussi les fichiers du disque
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" onClick={() => setConfirmRemove(false)}>
                    Annuler
                  </Button>
                  <Button
                    variant="danger"
                    pending={pending}
                    onClick={() =>
                      run(async () => {
                        const result = await removeMediaAction(mediaType, tmdbId, deleteFiles)
                        if (result.ok) setConfirmRemove(false)
                        return result
                      })
                    }
                  >
                    {deleteFiles ? 'Retirer et supprimer les fichiers' : 'Retirer'}
                  </Button>
                </div>
              </div>
            )}
            {feedbackLine}
          </section>
        </div>
      </Dialog>
    </div>
  )
}
