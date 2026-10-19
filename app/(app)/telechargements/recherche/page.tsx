import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/PageHeader'
import { requireAdmin } from '@/lib/auth/viewer'
import { SEARCH_CATEGORIES } from '@/lib/downloads/prowlarr-search'
import { errorMessage } from '@/lib/http'
import { SearchIcon } from '@/lib/icons'
import { getProwlarr } from '@/lib/services/prowlarr'
import { getSetting } from '@/lib/settings/store'
import { DownloadsNav } from '../DownloadsNav'
import { NotConfigured } from '../NotConfigured'
import { ReleaseSearch } from './ReleaseSearch'

export const metadata: Metadata = { title: 'Recherche · Téléchargements' }

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  await requireAdmin()
  const { q } = await searchParams
  const initialQuery = (Array.isArray(q) ? q[0] : q)?.slice(0, 200) ?? ''
  const configured = Boolean(getSetting('prowlarr_url') && getSetting('prowlarr_api_key'))
  // Les indexeurs servent au filtre ; Prowlarr en panne n'empêche pas d'essayer une recherche.
  const indexers = configured
    ? await getProwlarr()
        .indexers()
        .then((list) => list.filter((indexer) => indexer.enable).map(({ id, name }) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'fr')))
        .catch((error: unknown) => {
          console.warn(`[recherche] indexeurs Prowlarr : ${errorMessage(error)}`)
          return []
        })
    : []

  return (
    <>
      <PageHeader title="Téléchargements" description="Cherche une release dans tous les indexeurs de Prowlarr et envoie-la vers qBittorrent." actions={<DownloadsNav current="recherche" />} />
      {configured ? (
        <ReleaseSearch key={initialQuery} indexers={indexers} categories={SEARCH_CATEGORIES} initialQuery={initialQuery} />
      ) : (
        <NotConfigured icon={SearchIcon} service="Prowlarr" description="Renseigne l’adresse et la clé API de Prowlarr pour chercher dans tous tes indexeurs." />
      )}
    </>
  )
}
