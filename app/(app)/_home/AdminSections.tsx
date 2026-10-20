import Link from 'next/link'
import { Panel, Stat } from '@/components/ui/Panel'
import type { Viewer } from '@/lib/auth/viewer'
import { homeRequests, requestCounts } from '@/lib/home/requests'
import { RequestRow } from './UserSections'

/** Les demandes de tout le serveur, à côté du calendrier de l'accueil admin. */
export async function RequestsOverview({ viewer }: { viewer: Viewer }) {
  const counts = requestCounts()
  const latest = await homeRequests({ viewer: viewer.name }, 5)
  const waiting = counts.pending + counts.approved
  return (
    <Panel title="Demandes du serveur" href="/demandes/liste">
      <div className="grid grid-cols-3 gap-4">
        <Link href="/demandes/liste?statut=approved" className="rounded-card hover:opacity-80">
          <Stat label="En attente" value={waiting} tone={waiting > 0 ? 'warning' : undefined} />
        </Link>
        <Link href="/demandes/liste?statut=processing" className="rounded-card hover:opacity-80">
          <Stat label="En cours" value={counts.processing} />
        </Link>
        <Link href="/demandes/liste?statut=available" className="rounded-card hover:opacity-80">
          <Stat label="Disponibles" value={counts.available} />
        </Link>
      </div>
      {latest.length > 0 && (
        <>
          <h3 className="mt-5 mb-3 text-footnote font-semibold text-text-secondary">Dernières demandes</h3>
          <ul className="flex flex-col gap-4">
            {latest.map((request) => (
              <RequestRow key={request.ids.join('-')} request={request} showRequester />
            ))}
          </ul>
        </>
      )}
    </Panel>
  )
}
