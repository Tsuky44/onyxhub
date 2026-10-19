'use client'

import { useCallback, useDeferredValue, useMemo, useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { cn } from '@/lib/cn'
import {
  advancedFilterCount,
  COLUMN_OPTIONS,
  DEFAULT_COLUMNS,
  DEFAULT_FILTERS,
  filterTorrents,
  SORT_OPTIONS,
  sortTorrents,
  splitTags,
  STATUS_LABELS,
  trackerName,
  VISIBLE_STATUSES,
  type ColumnId,
  type SortKey,
  type SortOrder,
  type TorrentFilters,
} from '@/lib/downloads/torrents'
import {
  AddIcon,
  CloseIcon,
  ColumnsIcon,
  FilterIcon,
  PauseIcon,
  PlayIcon,
  PriorityBottomIcon,
  PriorityTopIcon,
  ReannounceIcon,
  SearchIcon,
  ShareLimitIcon,
  SortAscendingIcon,
  SortDescendingIcon,
  TrashIcon,
  WarningIcon,
} from '@/lib/icons'
import { countByStatus } from '@/lib/services/qbittorrent/filters'
import { useStoredValue } from '@/lib/use-stored-value'
import { torrentCommandAction, type ActionResult, type TorrentCommand } from '../actions'
import { AddTorrentDialog, ColumnsDialog, DeleteDialog, fieldClass, FiltersDialog, ShareLimitsDialog } from './TorrentDialogs'
import { TorrentRow } from './TorrentRow'
import { TransferStats } from './TransferStats'
import { useTorrentStream } from './useTorrentStream'

const COLUMN_IDS = new Set<string>(COLUMN_OPTIONS.map((column) => column.id))
const SORT_IDS = new Set<string>(SORT_OPTIONS.map((option) => option.id))

const parseColumns = (raw: string) => {
  const value: unknown = JSON.parse(raw)
  return Array.isArray(value) ? (value.filter((id) => typeof id === 'string' && COLUMN_IDS.has(id)) as ColumnId[]) : null
}
const parseSort = (raw: string) => {
  const value = JSON.parse(raw) as { key?: unknown; order?: unknown }
  return typeof value.key === 'string' && SORT_IDS.has(value.key) && (value.order === 'asc' || value.order === 'desc')
    ? { key: value.key as SortKey, order: value.order as SortOrder }
    : null
}
const DEFAULT_SORT = { key: 'added_on' as SortKey, order: 'desc' as SortOrder }

const BATCH: { command: TorrentCommand; label: string; icon: typeof PlayIcon }[] = [
  { command: 'resume', label: 'Reprendre', icon: PlayIcon },
  { command: 'pause', label: 'Pause', icon: PauseIcon },
  { command: 'reannounce', label: 'Réannoncer', icon: ReannounceIcon },
  { command: 'top', label: 'Tête de file', icon: PriorityTopIcon },
  { command: 'bottom', label: 'Fin de file', icon: PriorityBottomIcon },
]

function SkeletonList() {
  return (
    <ul aria-hidden className="divide-y divide-glass-border">
      {Array.from({ length: 6 }, (_, index) => (
        <li key={index} className="flex flex-col gap-2 px-4 py-4">
          <div className="h-4 w-2/3 animate-pulse rounded bg-elevated" />
          <div className="h-1.5 w-full animate-pulse rounded-full bg-elevated" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-elevated" />
        </li>
      ))}
    </ul>
  )
}

/**
 * Les torrents en direct : statuts, recherche, filtres, tri, colonnes,
 * sélection multiple et actions groupées (parité avec MediaHub). Tout le
 * filtrage se fait ici, sur l'état reçu en flux.
 */
export function TorrentManager() {
  const live = useTorrentStream()
  const [filters, setFilters] = useState<TorrentFilters>(DEFAULT_FILTERS)
  const [sort, setSort] = useStoredValue('onyxhub.torrents.tri', DEFAULT_SORT, parseSort)
  const [columnList, setColumns] = useStoredValue<ColumnId[]>('onyxhub.torrents.colonnes', DEFAULT_COLUMNS, parseColumns)
  const columns = useMemo(() => new Set(columnList), [columnList])
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [dialog, setDialog] = useState<'add' | 'filters' | 'columns' | null>(null)
  const [deleting, setDeleting] = useState<string[]>([])
  const [limiting, setLimiting] = useState<string[]>([])
  const [feedback, setFeedback] = useState<ActionResult | null>(null)
  const [pending, startTransition] = useTransition()

  const all = useMemo(() => [...live.torrents.values()], [live.torrents])
  // La recherche tape vite : la liste filtrée suit sans bloquer la saisie.
  const deferredFilters = useDeferredValue(filters)
  const visible = useMemo(() => sortTorrents(filterTorrents(all, deferredFilters), sort.key, sort.order), [all, deferredFilters, sort])
  const counts = useMemo(() => countByStatus(all), [all])
  const trackers = useMemo(() => [...new Set(all.map((torrent) => trackerName(torrent.tracker)))].sort((a, b) => a.localeCompare(b, 'fr')), [all])
  const tags = useMemo(() => [...new Set([...live.tags, ...all.flatMap((torrent) => splitTags(torrent.tags))])].sort((a, b) => a.localeCompare(b, 'fr')), [all, live.tags])
  // Une sélection ne garde que des torrents encore présents (un torrent supprimé ailleurs en sort).
  const selection = useMemo(() => [...selected].filter((hash) => live.torrents.has(hash)), [selected, live.torrents])
  const allVisibleSelected = visible.length > 0 && visible.every((torrent) => selected.has(torrent.hash))
  const advanced = advancedFilterCount(filters)

  const toggle = useCallback((hash: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(hash)) next.delete(hash)
      else next.add(hash)
      return next
    })
  }, [])

  const command = useCallback((hashes: string[], action: TorrentCommand) => {
    startTransition(async () => setFeedback(await torrentCommandAction(hashes, action)))
  }, [])
  const askDelete = useCallback((hashes: string[]) => setDeleting(hashes), [])

  const done = (result: ActionResult, clear = false) => {
    setFeedback(result)
    setDialog(null)
    setDeleting([])
    setLimiting([])
    if (clear) setSelected(new Set())
  }

  if (live.ready && live.error && all.length === 0) {
    return (
      <div className="flex items-start gap-3 rounded-panel border border-glass-border bg-surface p-5">
        <WarningIcon size={20} aria-hidden className="mt-0.5 shrink-0 text-warning" />
        <div>
          <p className="text-body font-semibold text-text">qBittorrent ne répond pas</p>
          <p className="mt-1 text-subhead text-text-secondary">{live.error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <TransferStats server={live.server} torrents={all} />

      {(live.status === 'lost' || (live.ready && live.error)) && (
        <p role="status" className="flex items-center gap-2 text-footnote text-warning">
          <WarningIcon size={16} aria-hidden />
          {live.error ?? 'Connexion au direct perdue, reconnexion…'}
        </p>
      )}

      <section aria-label="Torrents" className="rounded-panel border border-glass-border bg-surface">
        <div className="flex flex-col gap-3 border-b border-glass-border p-3 shell:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 basis-56">
              <SearchIcon size={16} aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-text-muted" />
              <input
                type="search"
                value={filters.search}
                onChange={(event) => setFilters({ ...filters, search: event.target.value })}
                placeholder="Chercher un torrent…"
                aria-label="Chercher un torrent"
                className={cn(fieldClass, 'pl-10')}
              />
            </div>
            <Button variant="secondary" onClick={() => setDialog('filters')} aria-label={advanced ? `Filtres (${advanced} actifs)` : 'Filtres'}>
              <FilterIcon size={16} aria-hidden />
              <span className="hidden sm:inline">Filtres</span>
              {advanced > 0 && <span className="font-mono text-accent-muted">{advanced}</span>}
            </Button>
            <div className="flex items-center gap-1">
              <label htmlFor="tri-torrents" className="sr-only">
                Trier par
              </label>
              <select id="tri-torrents" value={sort.key} onChange={(event) => setSort({ ...sort, key: event.target.value as SortKey })} className={cn(fieldClass, 'w-auto max-w-44')}>
                {SORT_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setSort({ ...sort, order: sort.order === 'asc' ? 'desc' : 'asc' })}
                aria-label={sort.order === 'asc' ? 'Ordre croissant (inverser)' : 'Ordre décroissant (inverser)'}
                className="flex size-11 items-center justify-center rounded-card border border-glass-border bg-glass-fill text-text-secondary hover:text-text"
              >
                {sort.order === 'asc' ? <SortAscendingIcon size={18} aria-hidden /> : <SortDescendingIcon size={18} aria-hidden />}
              </button>
            </div>
            <Button variant="ghost" onClick={() => setDialog('columns')} aria-label="Informations affichées">
              <ColumnsIcon size={18} aria-hidden />
            </Button>
            <Button onClick={() => setDialog('add')}>
              <AddIcon size={16} aria-hidden />
              Ajouter
            </Button>
          </div>

          <div role="group" aria-label="Statut" className="scrollbar-none -mx-3 flex gap-2 overflow-x-auto px-3 shell:-mx-4 shell:px-4">
            {VISIBLE_STATUSES.map((status) => (
              <Chip key={status} pressed={filters.status === status} onClick={() => setFilters({ ...filters, status })}>
                {STATUS_LABELS[status]}
                <span className="font-mono text-footnote opacity-70">{counts[status]}</span>
              </Chip>
            ))}
          </div>

          <div className="flex min-h-6 flex-wrap items-center justify-between gap-2 text-footnote text-text-secondary">
            <label className="flex min-h-11 shell:min-h-10 items-center gap-2">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                disabled={visible.length === 0}
                onChange={() => setSelected(allVisibleSelected ? new Set() : new Set(visible.map((torrent) => torrent.hash)))}
                className="size-5 accent-accent"
              />
              Tout sélectionner
            </label>
            <span aria-live="polite">
              {visible.length === all.length ? `${all.length} torrent${all.length > 1 ? 's' : ''}` : `${visible.length} sur ${all.length}`}
            </span>
          </div>
        </div>

        {!live.ready ? (
          <SkeletonList />
        ) : visible.length === 0 ? (
          <p className="px-4 py-10 text-center text-body text-text-secondary">{all.length === 0 ? 'Aucun torrent dans qBittorrent.' : 'Aucun torrent ne correspond.'}</p>
        ) : (
          <ul className="divide-y divide-glass-border">
            {visible.map((torrent) => (
              <TorrentRow key={torrent.hash} torrent={torrent} selected={selected.has(torrent.hash)} columns={columns} onToggle={toggle} onCommand={command} onDelete={askDelete} />
            ))}
          </ul>
        )}
      </section>

      {feedback && (
        <p role="status" className={cn('text-footnote', feedback.ok ? 'text-success' : 'text-error')}>
          {feedback.message}
        </p>
      )}

      {selection.length > 0 && (
        <div className="glass-strong sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 shell:bottom-4 flex flex-wrap items-center gap-1 rounded-panel border border-glass-border p-2 shadow-float">
          <span className="px-2 text-subhead font-semibold text-text">
            {selection.length} sélectionné{selection.length > 1 ? 's' : ''}
          </span>
          <div className="flex flex-1 flex-wrap items-center gap-1">
            {BATCH.map((action) => (
              <Button key={action.command} variant="ghost" disabled={pending} onClick={() => command(selection, action.command)} aria-label={action.label}>
                <action.icon size={18} aria-hidden />
                <span className="hidden lg:inline">{action.label}</span>
              </Button>
            ))}
            <Button variant="ghost" onClick={() => setLimiting(selection)} aria-label="Limites de partage">
              <ShareLimitIcon size={18} aria-hidden />
              <span className="hidden lg:inline">Limites</span>
            </Button>
            <Button variant="danger-quiet" onClick={() => setDeleting(selection)} aria-label="Supprimer la sélection">
              <TrashIcon size={18} aria-hidden />
              <span className="hidden lg:inline">Supprimer</span>
            </Button>
          </div>
          <Button variant="ghost" onClick={() => setSelected(new Set())} aria-label="Annuler la sélection">
            <CloseIcon size={18} aria-hidden />
          </Button>
        </div>
      )}

      <AddTorrentDialog open={dialog === 'add'} onClose={() => setDialog(null)} categories={live.categories} onDone={(result) => done(result)} />
      <FiltersDialog open={dialog === 'filters'} onClose={() => setDialog(null)} filters={filters} onChange={setFilters} categories={live.categories} tags={tags} trackers={trackers} />
      <ColumnsDialog open={dialog === 'columns'} onClose={() => setDialog(null)} columns={columns} onChange={setColumns} />
      <DeleteDialog
        key={`suppr-${deleting.join()}`}
        hashes={deleting}
        names={deleting.map((hash) => live.torrents.get(hash)?.name ?? hash)}
        onClose={() => setDeleting([])}
        onDone={(result) => done(result, true)}
      />
      <ShareLimitsDialog key={`limites-${limiting.join()}`} hashes={limiting} onClose={() => setLimiting([])} onDone={(result) => done(result)} />
    </div>
  )
}
