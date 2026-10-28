'use client'

import { useEffect, useMemo, useState } from 'react'
import { listDownloadsAction } from '@/app/(app)/demandes/liste/actions'
import { downloadTargets } from '@/lib/requests/download-targets'
import type { DownloadProgress } from '@/lib/requests/downloads'
import type { GroupDownloads } from '@/lib/requests/group-downloads'
import type { RequestGroup } from '@/lib/requests/list'
import { useLiveDownloads, type Measured } from './useLiveDownloads'

const POLL_MS = 5_000

const measure = (report: GroupDownloads): Measured => ({ downloads: report.downloads, age: report.age, receivedAt: Date.now() })

/**
 * La barre de chaque lot d'une liste de demandes (la liste, l'accueil). Une seule requête pour toute la liste,
 * toutes les 5 s, et seulement tant qu'un lot est « en cours » ou télécharge
 * et que l'onglet est visible ; entre deux, la barre avance seule.
 */
export function useListDownloads(groups: readonly RequestGroup[], initial: GroupDownloads): Record<string, DownloadProgress> {
  const [measured, setMeasured] = useState(() => measure(initial))
  const targets = useMemo(() => downloadTargets(groups), [groups])
  const watching = groups.some((group) => group.status === 'processing') || Object.keys(measured.downloads).length > 0

  useEffect(() => {
    if (!watching || targets.length === 0) return
    let cancelled = false
    const timer = setInterval(async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const next = await listDownloadsAction(targets)
        if (!cancelled) setMeasured(measure(next))
      } catch (error) {
        // La barre attend la mesure suivante ; la liste, elle, reste utilisable.
        console.warn('[demandes] téléchargements :', error)
      }
    }, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [watching, targets])

  return useLiveDownloads(measured)
}
