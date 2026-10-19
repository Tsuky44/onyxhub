'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import type { DownloadProgress } from '@/lib/requests/downloads'
import { formatBytes } from '@/lib/requests/format'
import type { MediaType } from '@/lib/services/tmdb/types'
import { downloadsAction } from './actions'

const POLL_MS = 5_000

function formatEta(seconds: number | null): string | null {
  if (seconds === null) return null
  if (seconds < 60) return 'moins d\'une minute'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  return `${hours} h ${String(minutes % 60).padStart(2, '0')}`
}

/**
 * La progression du téléchargement sur la fiche (file Radarr/Sonarr ↔ qBit),
 * rafraîchie toutes les 5 s tant que l'onglet est visible et qu'il y a
 * quelque chose à suivre. Quand le dernier téléchargement se termine, la
 * fiche se recharge pour afficher le nouveau statut.
 */
export function DownloadPanel({
  mediaType,
  tmdbId,
  tvdbId,
  initial,
  watching,
}: {
  mediaType: MediaType
  tmdbId: number
  tvdbId: number | null
  initial: DownloadProgress[]
  /** Le média est « en cours » : on surveille même si la file est encore vide. */
  watching: boolean
}) {
  const router = useRouter()
  const [items, setItems] = useState(initial)
  const hadItems = useRef(initial.length > 0)

  useEffect(() => {
    if (!watching && items.length === 0) return
    let cancelled = false
    const timer = setInterval(async () => {
      if (document.visibilityState !== 'visible') return
      const next = await downloadsAction(mediaType, tmdbId, tvdbId)
      if (cancelled) return
      setItems(next)
      if (hadItems.current && next.length === 0) router.refresh()
      hadItems.current = next.length > 0
    }, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [mediaType, tmdbId, tvdbId, watching, items.length, router])

  if (items.length === 0) return null

  return (
    <section aria-label="Téléchargement en cours" className="flex w-full max-w-xl flex-col gap-3">
      {items.map((item, index) => {
        const eta = formatEta(item.eta)
        return (
          <div key={`${item.title}-${index}`} className="rounded-panel border border-glass-border bg-glass-fill p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 truncate text-subhead font-semibold text-text" title={item.title}>
                {item.seasonNumber !== null ? `Saison ${item.seasonNumber} · ` : ''}
                {item.stalled ? 'En pause' : 'Téléchargement'}
              </p>
              <span className="font-mono text-subhead text-text">{item.progress.toLocaleString('fr-FR')} %</span>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(item.progress)}
              aria-label={`Progression de ${item.title}`}
              className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-elevated"
            >
              <div className="h-full rounded-full bg-accent transition-[width] duration-(--motion-emphasis) ease-onyx" style={{ width: `${item.progress}%` }} />
            </div>
            <p className="mt-2 truncate text-footnote text-text-muted" title={item.title}>
              {[
                item.speed ? `${formatBytes(item.speed)}/s` : null,
                eta ? `reste ${eta}` : null,
                `${formatBytes(item.sizeLeft)} sur ${formatBytes(item.size)}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        )
      })}
    </section>
  )
}
