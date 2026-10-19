import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/PageHeader'
import { requireAdmin } from '@/lib/auth/viewer'
import { DownloadIcon } from '@/lib/icons'
import { qbittorrentConfig } from '@/lib/services/qbittorrent/client'
import { DownloadsNav } from './DownloadsNav'
import { NotConfigured } from './NotConfigured'
import { TorrentManager } from './_torrents/TorrentManager'

export const metadata: Metadata = { title: 'Téléchargements' }

export default async function DownloadsPage() {
  await requireAdmin()
  return (
    <>
      <PageHeader title="Téléchargements" description="Les torrents de qBittorrent, en direct." actions={<DownloadsNav current="torrents" />} />
      {qbittorrentConfig() ? (
        <TorrentManager />
      ) : (
        <NotConfigured icon={DownloadIcon} service="qBittorrent" description="Renseigne l’adresse et les identifiants de qBittorrent pour suivre et gérer les torrents ici." />
      )}
    </>
  )
}
