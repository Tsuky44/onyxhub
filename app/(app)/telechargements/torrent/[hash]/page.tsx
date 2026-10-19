import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Badge } from '@/components/media/StatusBadge'
import { AutoRefresh } from '@/components/ui/AutoRefresh'
import { PanelSkeleton, ProgressBar } from '@/components/ui/Panel'
import { requireAdmin } from '@/lib/auth/viewer'
import { isTorrentHash } from '@/lib/downloads/hashes'
import { linkedMedia, loadTorrentDetail } from '@/lib/downloads/torrent-detail'
import { formatEta, formatSpeed, torrentState } from '@/lib/downloads/torrents'
import { BackIcon, SearchIcon } from '@/lib/icons'
import { isPaused } from '@/lib/services/qbittorrent/filters'
import { qbittorrentConfig } from '@/lib/services/qbittorrent/client'
import { TorrentActions } from './TorrentActions'
import { FilesSection, InfoSection, MediaSection, PeersSection, TrackersSection } from './TorrentSections'

export const metadata: Metadata = { title: 'Torrent' }

async function Media({ hash, name }: { hash: string; name: string }) {
  return <MediaSection media={await linkedMedia({ hash, name })} />
}

/** Un torrent : progression en direct (rafraîchie toutes les 5 s), actions, média lié, fichiers, trackers et pairs. */
export default async function TorrentPage({ params }: { params: Promise<{ hash: string }> }) {
  await requireAdmin()
  const { hash } = await params
  if (!isTorrentHash(hash) || !qbittorrentConfig()) notFound()
  const detail = await loadTorrentDetail(hash)
  if (!detail) notFound()
  const { torrent } = detail
  const state = torrentState(torrent)
  const paused = isPaused(torrent)
  const percent = Math.round(torrent.progress * 1000) / 10

  return (
    <>
      <AutoRefresh seconds={5} />
      <Link href="/telechargements" className="mb-6 inline-flex min-h-11 items-center gap-2 text-subhead font-medium text-text-secondary hover:text-text">
        <BackIcon size={18} aria-hidden />
        Téléchargements
      </Link>

      <header className="mb-8 flex flex-col gap-4">
        <div className="flex flex-wrap items-start gap-3">
          <h1 className="min-w-0 flex-1 basis-80 text-title2 font-bold tracking-[-0.01em] break-all text-text shell:text-title1">{torrent.name}</h1>
          <Badge label={state.label} tone={state.tone} />
        </div>
        <div className="flex flex-col gap-2">
          <ProgressBar value={percent} label={`Progression de ${torrent.name}`} tone={state.tone === 'error' ? 'error' : paused ? 'warning' : 'accent'} />
          <p className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-footnote text-text-secondary">
            <span>{percent.toLocaleString('fr-FR')} %</span>
            <span>↓ {formatSpeed(torrent.dlspeed)}</span>
            <span>↑ {formatSpeed(torrent.upspeed)}</span>
            {torrent.progress < 1 && <span>reste {formatEta(torrent.eta)}</span>}
          </p>
        </div>
        <TorrentActions hash={torrent.hash} name={torrent.name} paused={paused} queued={torrent.priority > 0} />
        <Link
          href={`/telechargements/recherche?q=${encodeURIComponent(torrent.name.replace(/\.(mkv|mp4|avi)$/i, '').replace(/[._]+/g, ' '))}`}
          className="inline-flex min-h-11 shell:min-h-10 items-center gap-1.5 self-start text-footnote font-medium text-text-secondary hover:text-text"
        >
          <SearchIcon size={14} aria-hidden />
          Chercher d’autres sources dans Prowlarr
        </Link>
      </header>

      {detail.errors.length > 0 && (
        <p role="status" className="mb-4 text-footnote text-warning">
          qBittorrent n’a pas tout renvoyé ({detail.errors.join(' ; ')}).
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Suspense fallback={<PanelSkeleton title="Média" />}>
            <Media hash={torrent.hash} name={torrent.name} />
          </Suspense>
          <InfoSection torrent={torrent} properties={detail.properties} />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          {detail.files && <FilesSection files={detail.files} />}
          {detail.trackers && <TrackersSection trackers={detail.trackers} />}
          {detail.peers && <PeersSection peers={detail.peers} />}
        </div>
      </div>
    </>
  )
}
