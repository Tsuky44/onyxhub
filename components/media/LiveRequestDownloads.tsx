'use client'

import { createContext, use, type ReactNode } from 'react'
import { ProgressBar } from '@/components/ui/Panel'
import type { DownloadProgress } from '@/lib/requests/downloads'
import type { GroupDownloads } from '@/lib/requests/group-downloads'
import type { RequestGroup } from '@/lib/requests/list'
import { useListDownloads } from './useListDownloads'

const Downloads = createContext<Readonly<Record<string, DownloadProgress>>>({})

/**
 * Les barres d'une liste de demandes rendue par le serveur (l'accueil) : une
 * seule relance pour toutes les lignes, qui restent des composants serveur.
 * Sans elle, la barre restait figée jusqu'au rechargement de la page.
 */
export function LiveRequestDownloads({ groups, initial, children }: { groups: readonly RequestGroup[]; initial: GroupDownloads; children: ReactNode }) {
  return <Downloads value={useListDownloads(groups, initial)}>{children}</Downloads>
}

/** La barre d'un lot, tant qu'il télécharge. */
export function RequestDownloadBar({ downloadKey, title }: { downloadKey: string; title: string }) {
  const download = use(Downloads)[downloadKey]
  if (!download) return null
  return <ProgressBar value={download.progress} label={`Téléchargement de ${title}`} tone={download.stalled ? 'warning' : 'accent'} />
}
