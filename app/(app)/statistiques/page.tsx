import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AutoRefresh } from '@/components/ui/AutoRefresh'
import { PageHeader } from '@/components/ui/PageHeader'
import { PanelSkeleton } from '@/components/ui/Panel'
import { requireAdmin } from '@/lib/auth/viewer'
import { ArrStatus, Downloads, OnyxServer, OnyxStats } from './StatsSections'

export const metadata: Metadata = { title: 'Statistiques' }

/**
 * Le tableau de bord du serveur, sorti de l'accueil qu'il encombrait :
 * lectures en cours, bibliothèque, visionnage des 30 derniers jours,
 * téléchargements et santé de Radarr/Sonarr. Réservé à l'admin, comme les
 * routes d'administration d'Onyx qu'il lit.
 */
export default async function StatsPage() {
  await requireAdmin()
  return (
    <>
      <PageHeader title="Statistiques" description="Ce qui se passe sur le serveur : lectures, bibliothèque, téléchargements et disques." />
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
          <Suspense fallback={<PanelSkeleton title="Téléchargements" rows={2} />}>
            <Downloads />
          </Suspense>
          <Suspense fallback={<PanelSkeleton title="Radarr et Sonarr" rows={2} />}>
            <ArrStatus />
          </Suspense>
        </div>
      </section>
    </>
  )
}
