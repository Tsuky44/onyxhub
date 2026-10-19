import type { Metadata } from 'next'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { RequestIcon } from '@/lib/icons'

export const metadata: Metadata = { title: 'Demandes' }

export default function RequestsPage() {
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
