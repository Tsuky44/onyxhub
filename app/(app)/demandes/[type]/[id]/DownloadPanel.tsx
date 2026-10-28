'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useLiveDownloads, type Measured } from '@/components/media/useLiveDownloads'
import { ProgressBar } from '@/components/ui/Panel'
import type { DownloadProgress, DownloadsSnapshot } from '@/lib/requests/downloads'
import { formatBytes } from '@/lib/requests/format'
import { formatEta, formatPercent } from '@/lib/requests/live-progress'
import type { MediaType } from '@/lib/services/tmdb/types'
import { downloadsAction } from './actions'

const POLL_MS = 5_000

// Une clé stable d'une mesure à l'autre : la barre d'une release ne recule pas parce qu'une autre a fini.
const keyed = (items: readonly DownloadProgress[]): Record<string, DownloadProgress> =>
  Object.fromEntries(items.map((item) => [`${item.seasonNumber ?? 'film'}:${item.title}`, item]))

const measure = (snapshot: DownloadsSnapshot): Measured => ({ downloads: keyed(snapshot.items), age: snapshot.age, receivedAt: Date.now() })

/**
 * La progression du téléchargement sur la fiche (rapport de sorraa, ou file
 * Radarr/Sonarr ↔ qBit), redemandée toutes les 5 s tant que l'onglet est
 * visible et qu'il y a quelque chose à suivre. Entre deux mesures, la barre
 * avance seule (useLiveDownloads). Quand le dernier téléchargement se termine,
 * la fiche se recharge pour afficher le nouveau statut.
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
  initial: DownloadsSnapshot
  /** Le média est « en cours » : on surveille même si la file est encore vide. */
  watching: boolean
}) {
  const router = useRouter()
  const [measured, setMeasured] = useState(() => measure(initial))
  const hadItems = useRef(initial.items.length > 0)
  const count = Object.keys(measured.downloads).length
  const shown = useLiveDownloads(measured)

  useEffect(() => {
    if (!watching && count === 0) return
    let cancelled = false
    const timer = setInterval(async () => {
      if (document.visibilityState !== 'visible') return
      const next = await downloadsAction(mediaType, tmdbId, tvdbId)
      if (cancelled) return
      setMeasured(measure(next))
      if (hadItems.current && next.items.length === 0) router.refresh()
      hadItems.current = next.items.length > 0
    }, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [mediaType, tmdbId, tvdbId, watching, count, router])

  const items = Object.entries(shown)
  if (items.length === 0) return null

  return (
    <section aria-label="Téléchargement en cours" className="flex w-full max-w-xl flex-col gap-3">
      {items.map(([key, item]) => {
        const eta = formatEta(item.eta)
        return (
          <div key={key} className="rounded-panel border border-glass-border bg-glass-fill p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 truncate text-subhead font-semibold text-text" title={item.title}>
                {item.seasonNumber !== null ? `Saison ${item.seasonNumber} · ` : ''}
                {item.stalled ? 'En pause' : 'Téléchargement'}
              </p>
              <span className="font-mono text-subhead text-text tabular-nums">{formatPercent(item.progress)}</span>
            </div>
            <ProgressBar value={item.progress} label={`Progression de ${item.title}`} tone={item.stalled ? 'warning' : 'accent'} className="mt-2.5" />
            <p className="mt-2 truncate text-footnote text-text-muted tabular-nums" title={item.title}>
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
