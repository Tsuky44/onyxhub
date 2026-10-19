'use client'

import { useMemo, useState } from 'react'
import { Stat } from '@/components/ui/Panel'
import { Dialog } from '@/components/ui/Dialog'
import { formatRatio, formatSpeed, sessionByTracker, type TorrentWire } from '@/lib/downloads/torrents'
import { ChevronRightIcon, DownSpeedIcon, UpSpeedIcon } from '@/lib/icons'
import { formatBytes } from '@/lib/requests/format'
import type { ServerState } from '@/lib/services/qbittorrent/types'

const CONNECTION: Record<string, { label: string; tone?: 'success' | 'warning' | 'error' }> = {
  connected: { label: 'Connecté', tone: 'success' },
  firewalled: { label: 'Derrière un pare-feu', tone: 'warning' },
  disconnected: { label: 'Déconnecté', tone: 'error' },
}

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-panel border border-glass-border bg-surface p-4">
      <div className="flex min-h-6 items-center justify-between gap-2">
        <h2 className="text-footnote font-semibold text-text-secondary">{title}</h2>
        {action}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">{children}</div>
    </section>
  )
}

/** Session par tracker : ce qui a été envoyé à chacun depuis le démarrage de qBit. */
function SessionDialog({ open, onClose, torrents }: { open: boolean; onClose: () => void; torrents: TorrentWire[] }) {
  const rows = useMemo(() => (open ? sessionByTracker(torrents) : []), [open, torrents])
  return (
    <Dialog open={open} onClose={onClose} title="Session par tracker" description="Depuis le dernier démarrage de qBittorrent, torrents encore présents." size="md">
      {rows.length === 0 ? (
        <p className="text-body text-text-secondary">Aucun torrent.</p>
      ) : (
        <table className="w-full text-left text-subhead">
          <thead className="text-footnote text-text-muted">
            <tr>
              <th scope="col" className="pb-2 font-medium">Tracker</th>
              <th scope="col" className="pb-2 text-right font-medium">Envoyé</th>
              <th scope="col" className="pb-2 text-right font-medium">Reçu</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-glass-border">
            {rows.map((row) => (
              <tr key={row.tracker}>
                <td className="max-w-0 truncate py-2 pr-3 text-text">
                  {row.tracker} <span className="text-footnote text-text-muted">· {row.count}</span>
                </td>
                <td className="py-2 text-right font-mono text-text">{formatBytes(row.uploaded)}</td>
                <td className="py-2 pl-3 text-right font-mono text-text-secondary">{formatBytes(row.downloaded)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Dialog>
  )
}

/** Débits, session et totaux de qBittorrent (la barre de stats de MediaHub). */
export function TransferStats({ server, torrents }: { server: ServerState; torrents: TorrentWire[] }) {
  const [sessionOpen, setSessionOpen] = useState(false)
  const connection = CONNECTION[server.connection_status ?? ''] ?? { label: 'Inconnu' }
  const peers = useMemo(
    () => torrents.reduce((total, torrent) => ({ seeds: total.seeds + torrent.num_seeds, leechs: total.leechs + torrent.num_leechs }), { seeds: 0, leechs: 0 }),
    [torrents],
  )
  const ratio = Number.parseFloat(server.global_ratio ?? '')

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Card title="Débits">
        <Stat
          label="Réception"
          value={
            <span className="inline-flex items-center gap-1">
              <DownSpeedIcon size={14} aria-hidden className="text-accent-muted" />
              {formatSpeed(server.dl_info_speed ?? 0)}
            </span>
          }
        />
        <Stat
          label="Envoi"
          value={
            <span className="inline-flex items-center gap-1">
              <UpSpeedIcon size={14} aria-hidden className="text-success" />
              {formatSpeed(server.up_info_speed ?? 0)}
            </span>
          }
        />
        <Stat label="Connexion" value={connection.label} tone={connection.tone} />
        <Stat label="Sources / pairs" value={`${peers.seeds} / ${peers.leechs}`} />
      </Card>
      <Card
        title="Session"
        action={
          <button
            type="button"
            onClick={() => setSessionOpen(true)}
            className="-my-2 inline-flex min-h-10 items-center gap-1 text-footnote font-medium text-text-secondary hover:text-text"
          >
            Par tracker
            <ChevronRightIcon size={12} aria-hidden />
          </button>
        }
      >
        <Stat label="Reçu" value={formatBytes(server.dl_info_data ?? 0)} />
        <Stat label="Envoyé" value={formatBytes(server.up_info_data ?? 0)} />
      </Card>
      <Card title="Depuis toujours">
        <Stat label="Reçu" value={formatBytes(server.alltime_dl ?? 0)} />
        <Stat label="Envoyé" value={formatBytes(server.alltime_ul ?? 0)} />
        <Stat label="Ratio" value={Number.isFinite(ratio) ? formatRatio(ratio) : '—'} tone={Number.isFinite(ratio) ? (ratio >= 1 ? 'success' : 'warning') : undefined} />
        <Stat label="Espace libre" value={server.free_space_on_disk !== undefined ? formatBytes(server.free_space_on_disk) : '—'} />
      </Card>
      <SessionDialog open={sessionOpen} onClose={() => setSessionOpen(false)} torrents={torrents} />
    </div>
  )
}
