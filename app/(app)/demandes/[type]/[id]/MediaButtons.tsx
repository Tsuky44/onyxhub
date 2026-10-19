'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { PlayIcon, SubscribedIcon, SubscribeIcon, WatchLaterIcon } from '@/lib/icons'
import type { MediaType } from '@/lib/services/tmdb/types'
import { setSubscriptionAction } from '../../../calendrier/actions'
import { setWatchLaterAction } from '../../actions'

/** « Plus tard » : l'état change tout de suite, et revient en arrière si l'enregistrement échoue. */
export function WatchLaterButton({
  item,
  initial,
}: {
  item: { mediaType: MediaType; tmdbId: number; title: string; posterPath: string | null }
  initial: boolean
}) {
  const [saved, setSaved] = useState(initial)
  const [pending, startTransition] = useTransition()
  return (
    <Button
      variant="secondary"
      aria-pressed={saved}
      disabled={pending}
      onClick={() => {
        const wanted = !saved
        setSaved(wanted)
        startTransition(async () => {
          try {
            setSaved(await setWatchLaterAction(item, wanted))
          } catch {
            setSaved(!wanted)
          }
        })
      }}
    >
      <WatchLaterIcon size={18} weight={saved ? 'fill' : 'regular'} aria-hidden />
      {saved ? 'Dans ta liste' : 'Plus tard'}
    </Button>
  )
}

/** « S'abonner » : les sorties du média entrent dans le calendrier du compte, même sans demande. */
export function SubscribeButton({
  item,
  initial,
}: {
  item: { mediaType: MediaType; tmdbId: number; title: string; posterPath: string | null }
  initial: boolean
}) {
  const [subscribed, setSubscribed] = useState(initial)
  const [pending, startTransition] = useTransition()
  const Icon = subscribed ? SubscribedIcon : SubscribeIcon
  return (
    <Button
      variant="secondary"
      aria-pressed={subscribed}
      disabled={pending}
      onClick={() => {
        const wanted = !subscribed
        setSubscribed(wanted)
        startTransition(async () => {
          try {
            setSubscribed(await setSubscriptionAction(item, wanted))
          } catch {
            setSubscribed(!wanted)
          }
        })
      }}
    >
      <Icon size={18} weight={subscribed ? 'fill' : 'regular'} aria-hidden />
      {subscribed ? 'Abonné' : "S'abonner"}
    </Button>
  )
}

/** La bande-annonce dans une modale, via youtube-nocookie : aucun cookie YouTube tant qu'on ne lance pas la vidéo. */
export function TrailerButton({ videoKey, title }: { videoKey: string; title: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <PlayIcon size={18} weight="fill" aria-hidden />
        Bande-annonce
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Bande-annonce : ${title}`} size="xl">
        <div className="aspect-video overflow-hidden rounded-panel bg-bg">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoKey)}?autoplay=1&rel=0`}
            title={`Bande-annonce de ${title}`}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="size-full"
          />
        </div>
      </Dialog>
    </>
  )
}
