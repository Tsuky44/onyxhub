import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/PageHeader'
import { readSession } from '@/lib/auth/session'
import { requireAdmin } from '@/lib/auth/viewer'
import { describeLink, readLinkState } from '@/lib/integration/onyx-link'
import { SERVICES } from '@/lib/settings/registry'
import { snapshotService } from '@/lib/settings/store'
import { ServiceCard } from './ServiceCard'

export const metadata: Metadata = { title: 'Réglages' }

export default async function SettingsPage() {
  await requireAdmin()
  const session = await readSession()
  // Un appel à Onyx (5 s au plus) : la carte de liaison dit si Onyx pointe bien ici.
  const link = session ? describeLink(await readLinkState(session.token)) : undefined
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Réglages"
        description="Les services branchés sur OnyxHub. Les clés et mots de passe sont chiffrés et ne sont jamais réaffichés."
      />
      <div className="flex flex-col gap-6">
        {SERVICES.map((service) => (
          <ServiceCard
            key={service.id}
            serviceId={service.id}
            snapshots={snapshotService(service.id)}
            note={'linksOnyx' in service && service.linksOnyx ? link : undefined}
          />
        ))}
      </div>
    </div>
  )
}
