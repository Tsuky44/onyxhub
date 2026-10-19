'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { Poster } from '@/components/media/Poster'
import { RequestStatusBadge } from '@/components/media/StatusBadge'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/cn'
import { ListIcon, RefreshIcon, SyncIcon, TrashIcon } from '@/lib/icons'
import { formatRelative, formatSeasons, mediaHref } from '@/lib/requests/format'
import type { RequestGroup, RequestListPage } from '@/lib/requests/list'
import { deleteRequestsAction, loadRequestPageAction, refreshStatusesAction, syncRequestsAction } from './actions'

type Feedback = { ok: boolean; message: string } | null

const keyOf = (group: RequestGroup) => group.ids.join('-')

/**
 * La liste des demandes de MediaHub : une ligne par lot, défilement infini,
 * et pour l'admin la sélection multiple, la suppression groupée et la
 * synchronisation avec Radarr/Sonarr.
 */
export function RequestList({ initial, search, isAdmin, viewerName }: { initial: RequestListPage; search: string; isAdmin: boolean; viewerName: string }) {
  const router = useRouter()
  const [groups, setGroups] = useState(initial.groups)
  const [nextOffset, setNextOffset] = useState(initial.nextOffset)
  const [hasMore, setHasMore] = useState(initial.hasMore)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirm, setConfirm] = useState<RequestGroup[] | null>(null)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [loading, startLoading] = useTransition()
  const [working, startWorking] = useTransition()
  const sentinel = useRef<HTMLDivElement>(null)

  // Le serveur renvoie une nouvelle première page après chaque action
  // (router.refresh) : la liste repart de celle-ci, le message reste affiché.
  const [shown, setShown] = useState(initial)
  if (shown !== initial) {
    setShown(initial)
    setGroups(initial.groups)
    setNextOffset(initial.nextOffset)
    setHasMore(initial.hasMore)
    setSelected(new Set())
  }

  const loadMore = useCallback(() => {
    if (loading || !hasMore) return
    startLoading(async () => {
      const page = await loadRequestPageAction(search, nextOffset)
      setGroups((previous) => {
        const seen = new Set(previous.map(keyOf))
        return [...previous, ...page.groups.filter((group) => !seen.has(keyOf(group)))]
      })
      setNextOffset(page.nextOffset)
      setHasMore(page.hasMore)
    })
  }, [loading, hasMore, search, nextOffset])

  useEffect(() => {
    const target = sentinel.current
    if (!target || !hasMore) return
    const observer = new IntersectionObserver((entries) => entries.some((entry) => entry.isIntersecting) && loadMore(), { rootMargin: '600px' })
    observer.observe(target)
    return () => observer.disconnect()
  }, [hasMore, loadMore])

  function run(action: () => Promise<{ ok: boolean; message: string }>, after?: () => void) {
    startWorking(async () => {
      const result = await action()
      setFeedback(result)
      if (result.ok) after?.()
      router.refresh()
    })
  }

  function toggle(group: RequestGroup) {
    setSelected((previous) => {
      const next = new Set(previous)
      const key = keyOf(group)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function remove(targets: RequestGroup[]) {
    const ids = targets.flatMap((group) => group.ids)
    const keys = new Set(targets.map(keyOf))
    run(
      () => deleteRequestsAction(ids),
      () => {
        setGroups((previous) => previous.filter((group) => !keys.has(keyOf(group))))
        setSelected(new Set())
        setConfirm(null)
      },
    )
  }

  const allSelected = groups.length > 0 && groups.every((group) => selected.has(keyOf(group)))
  const selectedGroups = groups.filter((group) => selected.has(keyOf(group)))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {isAdmin && groups.length > 0 && (
          <label className="mr-2 flex min-h-11 cursor-pointer items-center gap-2.5 text-subhead text-text-secondary">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => setSelected(allSelected ? new Set() : new Set(groups.map(keyOf)))}
              className="size-4 accent-accent"
            />
            {selected.size > 0 ? `${selected.size} sélectionnée${selected.size > 1 ? 's' : ''}` : 'Tout sélectionner'}
          </label>
        )}
        {isAdmin && selected.size > 0 && (
          <Button variant="danger-quiet" onClick={() => setConfirm(selectedGroups)}>
            <TrashIcon size={16} aria-hidden />
            Supprimer
          </Button>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="ghost" disabled={working} onClick={() => run(refreshStatusesAction)}>
            <RefreshIcon size={16} aria-hidden />
            Actualiser
          </Button>
          {isAdmin && (
            <Button variant="ghost" pending={working} onClick={() => run(syncRequestsAction)} title="Importe ce que Radarr et Sonarr surveillent sans l'avoir encore">
              <SyncIcon size={16} aria-hidden />
              Synchroniser
            </Button>
          )}
        </div>
      </div>
      {feedback && (
        <p role="status" className={cn('text-footnote', feedback.ok ? 'text-success' : 'text-error')}>
          {feedback.message}
        </p>
      )}

      {groups.length === 0 ? (
        <EmptyState icon={ListIcon} title="Aucune demande" description="Rien ne correspond à ces filtres pour l'instant." />
      ) : (
        <ul className="flex flex-col divide-y divide-glass-border overflow-hidden rounded-panel border border-glass-border bg-surface">
          {groups.map((group) => {
            const key = keyOf(group)
            const checked = selected.has(key)
            return (
              <li key={key} className={cn('flex items-center gap-3 px-3 py-3 shell:gap-4 shell:px-4', checked && 'bg-glass-fill')}>
                {isAdmin && (
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(group)}
                    aria-label={`Sélectionner ${group.title}`}
                    className="size-4 shrink-0 accent-accent"
                  />
                )}
                <Link href={mediaHref(group.mediaType, group.tmdbId)} className="flex min-w-0 flex-1 items-center gap-3 shell:gap-4">
                  <Poster path={group.posterPath} title={group.title} sizes="48px" source="w185" compact className="w-11 shrink-0 shell:w-12" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-callout font-semibold text-text">{group.title}</span>
                    <span className="block truncate text-footnote text-text-muted">
                      {group.mediaType === 'movie' ? 'Film' : formatSeasons(group.seasons) || 'Série'}
                      {' · '}
                      {group.requester === viewerName ? 'par toi' : `par ${group.requester}`}
                      {' · '}
                      {formatRelative(new Date(group.requestedAt))}
                    </span>
                  </span>
                </Link>
                <RequestStatusBadge status={group.status} />
                {isAdmin && (
                  <button
                    type="button"
                    disabled={working}
                    onClick={() => setConfirm([group])}
                    aria-label={`Supprimer la demande « ${group.title} »`}
                    className="flex size-11 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors duration-(--motion-micro) ease-onyx hover:bg-glass-fill hover:text-error disabled:opacity-50"
                  >
                    <TrashIcon size={18} aria-hidden />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <div ref={sentinel} aria-hidden className="h-px" />
      {loading && (
        <div className="flex justify-center py-4">
          <span className="size-5 animate-spin rounded-full border-2 border-text-muted border-r-transparent" aria-label="Chargement" />
        </div>
      )}

      <Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm && confirm.length > 1 ? `Supprimer ${confirm.length} demandes ?` : 'Supprimer cette demande ?'}
        description="Les saisons et films que plus personne ne demande cessent d'être surveillés, et ce qui n'a encore aucun fichier quitte Radarr ou Sonarr. Les fichiers déjà téléchargés restent."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Annuler
            </Button>
            <Button variant="danger" pending={working} onClick={() => confirm && remove(confirm)}>
              Supprimer
            </Button>
          </>
        }
      >
        {confirm && confirm.length <= 5 && (
          <ul className="flex flex-col gap-1 text-body text-text">
            {confirm.map((group) => (
              <li key={keyOf(group)}>
                « {group.title} »{group.seasons.length > 0 ? ` · ${formatSeasons(group.seasons)}` : ''}
              </li>
            ))}
          </ul>
        )}
      </Dialog>
    </div>
  )
}
