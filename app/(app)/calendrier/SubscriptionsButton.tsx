'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Poster } from '@/components/media/Poster'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import type { Subscription } from '@/lib/calendar/subscriptions'
import { SubscribedIcon } from '@/lib/icons'
import { mediaHref } from '@/lib/requests/format'
import { setSubscriptionAction } from './actions'

function SubscriptionRow({ subscription, onClose }: { subscription: Subscription; onClose: () => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState(false)
  return (
    <li className="flex items-center gap-3">
      <Poster path={subscription.posterPath} title={subscription.title} sizes="40px" source="w185" compact className="w-10 shrink-0" />
      <span className="min-w-0 flex-1">
        <Link href={mediaHref(subscription.mediaType, subscription.tmdbId)} onClick={onClose} className="block truncate text-subhead font-semibold text-text hover:underline">
          {subscription.title}
        </Link>
        <span className={error ? 'text-footnote text-error' : 'text-footnote text-text-muted'}>
          {error ? 'Échec, réessaie.' : subscription.mediaType === 'movie' ? 'Film' : 'Série'}
        </span>
      </span>
      <Button
        variant="ghost"
        pending={pending}
        onClick={() =>
          startTransition(async () => {
            const subscribed = await setSubscriptionAction(subscription, false).catch(() => true)
            setError(subscribed)
            if (!subscribed) router.refresh()
          })
        }
      >
        Se désabonner
      </Button>
    </li>
  )
}

/** Les abonnements du compte, retirables sans repasser par chaque fiche. */
export function SubscriptionsButton({ subscriptions }: { subscriptions: Subscription[] }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} aria-label={`Abonnements (${subscriptions.length})`}>
        <SubscribedIcon size={18} aria-hidden />
        Abonnements
        <span className="font-mono text-text-secondary">{subscriptions.length}</span>
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Mes abonnements" description="Leurs sorties apparaissent dans ton calendrier, même sans demande." size="md">
        {subscriptions.length === 0 ? (
          <p className="text-body text-text-secondary">Aucun abonnement. Sur la fiche d&apos;un film ou d&apos;une série à venir, « S&apos;abonner » ajoute ses sorties ici.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {subscriptions.map((subscription) => (
              <SubscriptionRow key={`${subscription.mediaType}-${subscription.tmdbId}`} subscription={subscription} onClose={() => setOpen(false)} />
            ))}
          </ul>
        )}
      </Dialog>
    </>
  )
}
