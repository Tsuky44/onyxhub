import type { Metadata } from 'next'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { requireAdmin } from '@/lib/auth/viewer'
import { SettingsIcon } from '@/lib/icons'

export const metadata: Metadata = { title: 'Réglages' }

export default async function SettingsPage() {
  await requireAdmin()
  return (
    <>
      <PageHeader title="Réglages" description="Les services branchés sur OnyxHub." />
      <EmptyState
        icon={SettingsIcon}
        title="Les réglages arrivent en phase 1"
        description="Onyx, TMDB, Radarr, Sonarr, qBittorrent, Prowlarr et SMB, avec un bouton pour tester chaque connexion."
      />
    </>
  )
}
