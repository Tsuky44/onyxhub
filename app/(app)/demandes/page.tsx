import type { Metadata } from 'next'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { getViewer } from '@/lib/auth/viewer'
import { RequestIcon } from '@/lib/icons'

export const metadata: Metadata = { title: 'Demandes' }

export default async function RequestsPage() {
  // Chaque page revérifie la session : le layout ne se re-rend pas à la navigation.
  await getViewer()
  return (
    <>
      <PageHeader title="Demandes" description="Trouve un film ou une série et demande-le au serveur." />
      <EmptyState
        icon={RequestIcon}
        title="Les demandes arrivent en phase 3"
        description="Découverte TMDB, fiches, saisons, suivi de tes demandes et gestion pour l'admin."
      />
    </>
  )
}
