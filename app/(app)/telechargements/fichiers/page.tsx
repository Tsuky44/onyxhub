import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { PanelError } from '@/components/ui/Panel'
import { requireAdmin } from '@/lib/auth/viewer'
import { listShares } from '@/lib/files/shares'
import { settle } from '@/lib/home/admin'
import { ChevronRightIcon, FolderIcon } from '@/lib/icons'
import { getSmb, smbConfig } from '@/lib/services/smb/client'
import { breadcrumbs, InvalidPathError, joinPath, splitPath } from '@/lib/services/smb/paths'
import { DownloadsNav } from '../DownloadsNav'
import { NotConfigured } from '../NotConfigured'
import { FileList } from './FileList'
import { SharesButton } from './ShareDialogs'

export const metadata: Metadata = { title: 'Fichiers · Téléchargements' }

function safePath(raw: string | string[] | undefined): string | null {
  try {
    return joinPath(splitPath(Array.isArray(raw) ? raw[0] : raw))
  } catch (error) {
    if (error instanceof InvalidPathError) return null
    throw error
  }
}

async function Folder({ path }: { path: string }) {
  const result = await settle(() => getSmb().list(path))
  if (!result.ok) {
    return (
      <div className="p-5">
        <PanelError message={result.message} />
      </div>
    )
  }
  return <FileList entries={result.value} />
}

function FolderSkeleton() {
  return (
    <ul aria-hidden className="divide-y divide-glass-border">
      {Array.from({ length: 8 }, (_, index) => (
        <li key={index} className="flex items-center gap-3 px-4 py-3">
          <div className="size-6 animate-pulse rounded bg-elevated" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-elevated" />
        </li>
      ))}
    </ul>
  )
}

/** L'explorateur du partage SMB : dossiers, téléchargement, liens de partage, suppression. */
export default async function FilesPage({ searchParams }: { searchParams: Promise<{ chemin?: string | string[] }> }) {
  await requireAdmin()
  const path = safePath((await searchParams).chemin)
  const configured = smbConfig() !== null

  return (
    <>
      <PageHeader title="Téléchargements" description="Les fichiers du partage SMB : parcourir, télécharger, partager par lien." actions={<DownloadsNav current="fichiers" />} />
      {!configured ? (
        <NotConfigured icon={FolderIcon} service="Le partage SMB" description="Renseigne l’hôte, le partage et le compte SMB pour parcourir les fichiers ici." />
      ) : path === null ? (
        <PanelError message="Chemin invalide." />
      ) : (
        <section aria-label="Fichiers" className="rounded-panel border border-glass-border bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-glass-border p-3 shell:px-4">
            <nav aria-label="Dossiers" className="min-w-0 flex-1">
              <ol className="flex flex-wrap items-center gap-1 text-subhead">
                {breadcrumbs(path).map((crumb, index, all) => (
                  <li key={crumb.path} className="flex min-w-0 items-center gap-1">
                    {index > 0 && <ChevronRightIcon size={12} aria-hidden className="shrink-0 text-text-muted" />}
                    {index === all.length - 1 ? (
                      <span aria-current="page" className="truncate font-semibold text-text">
                        {crumb.name}
                      </span>
                    ) : (
                      <Link
                        href={crumb.path ? `/telechargements/fichiers?chemin=${encodeURIComponent(crumb.path)}` : '/telechargements/fichiers'}
                        className="inline-flex min-h-11 shell:min-h-10 items-center truncate text-text-secondary hover:text-text"
                      >
                        {crumb.name}
                      </Link>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
            <SharesButton shares={listShares()} />
          </div>
          <Suspense key={path} fallback={<FolderSkeleton />}>
            <Folder path={path} />
          </Suspense>
        </section>
      )}
    </>
  )
}
