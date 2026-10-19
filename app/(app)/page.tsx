import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PanelSkeleton } from '@/components/ui/Panel'
import { getViewer } from '@/lib/auth/viewer'
import { greeting } from '@/lib/home/greeting'
import { ArrStatus, Downloads, OnyxServer, OnyxStats, RequestsOverview } from './_home/AdminSections'
import { AutoRefresh } from './_home/AutoRefresh'
import { ForYou, HomeSearch, MyRequests, UpcomingReleases } from './_home/UserSections'

export const metadata: Metadata = { title: { absolute: 'OnyxHub' } }

/**
 * L'accueil selon le rôle : l'admin voit d'abord le résumé du serveur (Onyx,
 * demandes, téléchargements, Radarr/Sonarr), tout le monde voit ses
 * demandes, les prochaines sorties et ses recommandations. Chaque bloc se
 * charge à part : un service lent ou éteint ne retient pas les autres.
 */
export default async function HomePage() {
  const viewer = await getViewer()
  const now = new Date()

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-5">
        <div>
          <h1 className="text-title1 font-bold tracking-[-0.02em] text-balance text-text shell:text-large-title">
            {greeting(now.getHours())}, {viewer.name}
          </h1>
          <p className="mt-1.5 text-callout text-text-secondary">
            {viewer.isAdmin ? 'Le serveur, les demandes et ce qui sort bientôt.' : 'Tes demandes et ce qui sort bientôt.'}
          </p>
        </div>
        <HomeSearch />
      </header>

      {viewer.isAdmin && (
        <section aria-label="Résumé du serveur" className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <AutoRefresh seconds={20} />
          <div className="flex min-w-0 flex-col gap-6">
            <Suspense fallback={<PanelSkeleton title="Lectures en cours" rows={3} />}>
              <OnyxServer />
            </Suspense>
            <Suspense fallback={<PanelSkeleton title="30 derniers jours" rows={2} />}>
              <OnyxStats />
            </Suspense>
          </div>
          <div className="flex min-w-0 flex-col gap-6">
            <Suspense fallback={<PanelSkeleton title="Demandes du serveur" rows={3} />}>
              <RequestsOverview viewer={viewer} />
            </Suspense>
            <Suspense fallback={<PanelSkeleton title="Téléchargements" rows={2} />}>
              <Downloads />
            </Suspense>
            <Suspense fallback={<PanelSkeleton title="Radarr et Sonarr" rows={2} />}>
              <ArrStatus />
            </Suspense>
          </div>
        </section>
      )}

      <div className="grid gap-6 shell:grid-cols-2">
        <Suspense fallback={<PanelSkeleton title="Mes demandes" rows={3} />}>
          <MyRequests viewer={viewer} />
        </Suspense>
        <Suspense fallback={<PanelSkeleton title="Prochaines sorties" rows={3} />}>
          <UpcomingReleases viewer={viewer} now={now} />
        </Suspense>
      </div>

      <Suspense fallback={null}>
        <ForYou viewer={viewer} />
      </Suspense>
    </div>
  )
}
