import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { getViewer } from '@/lib/auth/viewer'
import { ComingSoonIcon } from '@/lib/icons'

export default async function HomePage() {
  const viewer = await getViewer()
  return (
    <>
      <PageHeader
        title={`Bonjour, ${viewer.name}`}
        description={
          viewer.isAdmin
            ? 'Le résumé du serveur, les demandes en cours et les prochaines sorties.'
            : 'Tes demandes et les prochaines sorties.'
        }
      />
      <EmptyState
        icon={ComingSoonIcon}
        title="L'accueil arrive en phase 4"
        description={
          viewer.isAdmin
            ? 'Lectures en cours sur Onyx, demandes à traiter, débits qBittorrent et santé de Radarr et Sonarr.'
            : 'Tes demandes récentes avec leur statut, et un aperçu du calendrier.'
        }
      />
    </>
  )
}
