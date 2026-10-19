import type { Metadata } from 'next'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { getViewer } from '@/lib/auth/viewer'
import { CalendarIcon } from '@/lib/icons'

export const metadata: Metadata = { title: 'Calendrier' }

export default async function CalendarPage() {
  // Chaque page revérifie la session : le layout ne se re-rend pas à la navigation.
  await getViewer()
  return (
    <>
      <PageHeader title="Calendrier" description="Les sorties à venir des films et séries demandés." />
      <EmptyState
        icon={CalendarIcon}
        title="Le calendrier arrive en phase 5"
        description="Sorties Radarr, épisodes Sonarr, tes demandes mises en avant et tes abonnements."
      />
    </>
  )
}
