'use client'

import Link from 'next/link'
import { memo } from 'react'
import { Badge } from '@/components/media/StatusBadge'
import { ProgressBar } from '@/components/ui/Panel'
import { cn } from '@/lib/cn'
import { formatEta, formatRatio, formatSpeed, splitTags, torrentState, trackerName, type ColumnId, type TorrentWire } from '@/lib/downloads/torrents'
import { DownSpeedIcon, PauseIcon, PlayIcon, TrashIcon, UpSpeedIcon } from '@/lib/icons'
import { formatBytes } from '@/lib/requests/format'
import { isPaused } from '@/lib/services/qbittorrent/filters'

const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
const DATE_TIME = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const date = (seconds: number, format = DATE) => (seconds > 0 ? format.format(new Date(seconds * 1000)) : null)

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
      <span className="text-text-muted">{label}</span>
      <span className="font-mono text-text-secondary">{children}</span>
    </span>
  )
}

const iconButton =
  'flex size-11 shell:size-10 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors duration-(--motion-micro) ease-onyx hover:bg-glass-fill hover:text-text'

/**
 * Une ligne de la liste : mémoïsée, elle ne se redessine que si son torrent
 * a changé (le flux ne recrée que ceux-là) ou si les colonnes changent.
 */
export const TorrentRow = memo(function TorrentRow({
  torrent,
  selected,
  columns,
  onToggle,
  onCommand,
  onDelete,
}: {
  torrent: TorrentWire
  selected: boolean
  columns: ReadonlySet<ColumnId>
  onToggle: (hash: string) => void
  onCommand: (hashes: string[], command: 'pause' | 'resume') => void
  onDelete: (hashes: string[]) => void
}) {
  const state = torrentState(torrent)
  const paused = isPaused(torrent)
  const percent = Math.round(torrent.progress * 1000) / 10
  const tags = columns.has('tags') ? splitTags(torrent.tags) : []
  const labels = [
    columns.has('tracker') ? trackerName(torrent.tracker) : null,
    columns.has('category') && torrent.category ? torrent.category : null,
  ].filter((label): label is string => label !== null)

  return (
    <li className={cn('lazy-row flex gap-3 px-3 py-3 shell:px-4', selected && 'bg-glass-fill')}>
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggle(torrent.hash)}
        aria-label={`Sélectionner ${torrent.name}`}
        className="mt-1 size-5 shrink-0 accent-accent"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start gap-2">
          <Link
            href={`/telechargements/torrent/${torrent.hash}`}
            title={torrent.name}
            className="min-w-0 flex-1 text-subhead font-semibold break-all text-text hover:underline sm:truncate sm:break-normal"
          >
            {torrent.name}
          </Link>
          {columns.has('status') && (
            // Le badge porte son propre `inline-flex` : c'est l'enveloppe qui se masque sur téléphone.
            <span className="hidden shrink-0 sm:inline-flex">
              <Badge label={state.label} tone={state.tone} />
            </span>
          )}
        </div>

        {(labels.length > 0 || tags.length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5 text-caption">
            {labels.map((label) => (
              <span key={label} className="rounded-full border border-glass-border px-2 py-0.5 text-text-secondary">
                {label}
              </span>
            ))}
            {tags.map((tag) => (
              <span key={tag} className="rounded-full bg-glass-fill px-2 py-0.5 text-text-muted">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {columns.has('progress') && (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <ProgressBar value={percent} label={`Progression de ${torrent.name}`} tone={state.tone === 'error' ? 'error' : paused ? 'warning' : 'accent'} />
            </div>
            <span className="w-14 shrink-0 text-right font-mono text-footnote text-text-secondary">{percent.toLocaleString('fr-FR')} %</span>
          </div>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-footnote">
          {columns.has('status') && (
            <span className="sm:hidden">
              <Badge label={state.label} tone={state.tone} />
            </span>
          )}
          <Meta label="Taille">{formatBytes(torrent.size)}</Meta>
          {columns.has('speeds') && (
            <span className="inline-flex items-center gap-3 font-mono whitespace-nowrap text-text-secondary">
              <span className="inline-flex items-center gap-1">
                <DownSpeedIcon size={12} aria-label="Réception" className="text-accent-muted" />
                {formatSpeed(torrent.dlspeed)}
              </span>
              <span className="inline-flex items-center gap-1">
                <UpSpeedIcon size={12} aria-label="Envoi" className="text-success" />
                {formatSpeed(torrent.upspeed)}
              </span>
            </span>
          )}
          {columns.has('transfer') && (
            <Meta label="Reçu / envoyé">
              {formatBytes(torrent.downloaded)} / {formatBytes(torrent.uploaded)}
            </Meta>
          )}
          {columns.has('ratio') && <Meta label="Ratio">{formatRatio(torrent.ratio)}</Meta>}
          {columns.has('peers') && (
            <Meta label="Sources / pairs">
              {torrent.num_seeds} / {torrent.num_leechs}
            </Meta>
          )}
          {columns.has('availability') && <Meta label="Dispo.">{torrent.availability < 0 ? '—' : torrent.availability.toFixed(2)}</Meta>}
          {columns.has('eta') && torrent.progress < 1 && <Meta label="Reste">{formatEta(torrent.eta)}</Meta>}
          {columns.has('added_on') && date(torrent.added_on) && <Meta label="Ajouté">{date(torrent.added_on)}</Meta>}
          {columns.has('completion_on') && date(torrent.completion_on) && <Meta label="Fini">{date(torrent.completion_on)}</Meta>}
          {columns.has('last_activity') && date(torrent.last_activity, DATE_TIME) && <Meta label="Actif">{date(torrent.last_activity, DATE_TIME)}</Meta>}
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
        <button
          type="button"
          onClick={() => onCommand([torrent.hash], paused ? 'resume' : 'pause')}
          aria-label={paused ? `Reprendre ${torrent.name}` : `Mettre en pause ${torrent.name}`}
          className={iconButton}
        >
          {paused ? <PlayIcon size={18} aria-hidden /> : <PauseIcon size={18} aria-hidden />}
        </button>
        <button type="button" onClick={() => onDelete([torrent.hash])} aria-label={`Supprimer ${torrent.name}`} className={cn(iconButton, 'hover:text-error')}>
          <TrashIcon size={18} aria-hidden />
        </button>
      </div>
    </li>
  )
})
