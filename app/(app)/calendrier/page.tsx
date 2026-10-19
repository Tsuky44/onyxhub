import type { Metadata } from 'next'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { CalendarIcon } from '@/lib/icons'

export const metadata: Metadata = { title: 'Calendrier' }

export default function CalendarPage() {
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
