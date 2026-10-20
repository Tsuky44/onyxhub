import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PanelSkeleton } from '@/components/ui/Panel'
import { getViewer } from '@/lib/auth/viewer'
import { localDay } from '@/lib/calendar/releases'
import { greeting } from '@/lib/home/greeting'
import { RequestsOverview } from './_home/AdminSections'
import { ForYou, HomeCalendar, HomeCalendarSkeleton, HomeSearch, MyRequests } from './_home/UserSections'

export const metadata: Metadata = { title: { absolute: 'OnyxHub' } }

/**
 * L'accueil, sur le modèle de MediaHub : le calendrier du mois, les demandes
 * à côté (celles du serveur pour l'admin, les siennes sinon), puis les
 * recommandations. Les chiffres du serveur (lectures, bibliothèque, disques)
 * vivent sur /statistiques : ils noyaient l'accueil. Chaque bloc se charge à
 * part : un service lent ou éteint ne retient pas les autres.
 */
export default async function HomePage() {
  const viewer = await getViewer()
  const now = new Date()
  const today = localDay(now)

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-5">
        <div>
          <h1 className="text-title1 font-bold tracking-[-0.02em] text-balance text-text shell:text-large-title">
            {greeting(now.getHours())}, {viewer.name}
          </h1>
          <p className="mt-1.5 text-callout text-text-secondary">
            {viewer.isAdmin ? 'Ce qui sort ce mois-ci et les demandes du serveur.' : 'Ce qui sort ce mois-ci et tes demandes.'}
          </p>
        </div>
        <HomeSearch />
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Suspense fallback={<HomeCalendarSkeleton today={today} />}>
          <HomeCalendar viewer={viewer} today={today} />
        </Suspense>
        {viewer.isAdmin ? (
          <Suspense fallback={<PanelSkeleton title="Demandes du serveur" rows={3} />}>
            <RequestsOverview viewer={viewer} />
          </Suspense>
        ) : (
          <Suspense fallback={<PanelSkeleton title="Mes demandes" rows={3} />}>
            <MyRequests viewer={viewer} />
          </Suspense>
        )}
      </div>

      <Suspense fallback={null}>
        <ForYou viewer={viewer} />
      </Suspense>
    </div>
  )
}
