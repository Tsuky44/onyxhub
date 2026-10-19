import type { Metadata } from 'next'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { requireAdmin } from '@/lib/auth/viewer'
import { DownloadIcon } from '@/lib/icons'

export const metadata: Metadata = { title: 'Téléchargements' }

export default async function DownloadsPage() {
  await requireAdmin()
  return (
    <>
      <PageHeader title="Téléchargements" description="qBittorrent, recherche Prowlarr et fichiers SMB." />
      <EmptyState
        icon={DownloadIcon}
        title="Les téléchargements arrivent en phase 6"
        description="Liste des torrents en direct, actions groupées, détail d'un torrent, recherche et partage de fichiers."
      />
    </>
  )
}
