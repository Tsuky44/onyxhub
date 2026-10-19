import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/PageHeader'
import { getViewer } from '@/lib/auth/viewer'
import { errorMessage } from '@/lib/http'
import { loadRequestPage, parseListFilters } from '@/lib/requests/list'
import { refreshStatuses } from '@/lib/requests/sync'
import { RequestsNav } from '../RequestsNav'
import { ListFilters } from './ListFilters'
import { RequestList } from './RequestList'

export const metadata: Metadata = { title: 'Suivi des demandes' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function RequestTrackingPage({ searchParams }: { searchParams: SearchParams }) {
  const viewer = await getViewer()
  const raw = await searchParams
  const search = new URLSearchParams(Object.entries(raw).flatMap(([key, value]) => (typeof value === 'string' ? [[key, value]] : []))).toString()

  // Comme MediaHub à chaque affichage : les statuts rattrapent Radarr/Sonarr
  // (index de bibliothèque partagé, donc au plus quatre appels par minute).
  await refreshStatuses().catch((error: unknown) => console.warn(`[demandes] statuts : ${errorMessage(error)}`))
  const initial = loadRequestPage(parseListFilters(new URLSearchParams(search), viewer.name), 0)

  return (
    <>
      <PageHeader title="Demandes" description="Tout ce qui a été demandé au serveur, et où ça en est." actions={<RequestsNav current="liste" />} />
      <div className="flex flex-col gap-6">
        <ListFilters search={search} />
        <RequestList key={search} initial={initial} search={search} isAdmin={viewer.isAdmin} viewerName={viewer.name} />
      </div>
    </>
  )
}
