import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/PageHeader'
import { requireAdmin } from '@/lib/auth/viewer'
import { SERVICES } from '@/lib/settings/registry'
import { snapshotService } from '@/lib/settings/store'
import { ServiceCard } from './ServiceCard'

export const metadata: Metadata = { title: 'Réglages' }

export default async function SettingsPage() {
  await requireAdmin()
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Réglages"
        description="Les services branchés sur OnyxHub. Les clés et mots de passe sont chiffrés et ne sont jamais réaffichés."
      />
      <div className="flex flex-col gap-6">
        {SERVICES.map((service) => (
          <ServiceCard key={service.id} serviceId={service.id} snapshots={snapshotService(service.id)} />
        ))}
      </div>
    </div>
  )
}
