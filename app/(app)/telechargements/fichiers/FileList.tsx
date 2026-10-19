'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { cn } from '@/lib/cn'
import { DownloadIcon, FileIcon, FolderIcon, ShareIcon, TrashIcon } from '@/lib/icons'
import { formatBytes } from '@/lib/requests/format'
import type { FileEntry } from '@/lib/services/smb/client'
import { deletePathAction, type FileActionResult } from './actions'
import { ShareDialog } from './ShareDialogs'

const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

const iconButton =
  'flex size-10 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors duration-(--motion-micro) ease-onyx hover:bg-glass-fill hover:text-text'

const folderHref = (path: string) => (path ? `/telechargements/fichiers?chemin=${encodeURIComponent(path)}` : '/telechargements/fichiers')

/** Le contenu d'un dossier : ouvrir, télécharger (un dossier en ZIP), partager, supprimer. */
export function FileList({ entries }: { entries: FileEntry[] }) {
  const router = useRouter()
  const [sharing, setSharing] = useState<FileEntry | null>(null)
  const [deleting, setDeleting] = useState<FileEntry | null>(null)
  const [feedback, setFeedback] = useState<FileActionResult | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <>
      {entries.length === 0 ? (
        <p className="px-4 py-10 text-center text-body text-text-secondary">Ce dossier est vide.</p>
      ) : (
        <ul className="divide-y divide-glass-border">
          {entries.map((entry) => {
            const Icon = entry.kind === 'folder' ? FolderIcon : FileIcon
            const meta = [entry.kind === 'file' ? formatBytes(entry.size) : 'Dossier', entry.modifiedAt ? DATE.format(new Date(entry.modifiedAt)) : null].filter(Boolean).join(' · ')
            const body = (
              <>
                <Icon size={22} weight={entry.kind === 'folder' ? 'fill' : 'regular'} aria-hidden className={cn('shrink-0', entry.kind === 'folder' ? 'text-accent-muted' : 'text-text-muted')} />
                <span className="min-w-0 flex-1">
                  <span className="block text-subhead font-medium break-all text-text">{entry.name}</span>
                  <span className="block text-footnote text-text-muted">{meta}</span>
                </span>
              </>
            )
            return (
              <li key={entry.path} className="lazy-row flex items-center gap-1 px-2 py-1.5 shell:px-3">
                {entry.kind === 'folder' ? (
                  <Link href={folderHref(entry.path)} className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-card px-2 hover:bg-glass-fill">
                    {body}
                  </Link>
                ) : (
                  <div className="flex min-h-12 min-w-0 flex-1 items-center gap-3 px-2">{body}</div>
                )}
                <a href={`/api/fichiers?chemin=${encodeURIComponent(entry.path)}`} download aria-label={entry.kind === 'folder' ? `Télécharger ${entry.name} en ZIP` : `Télécharger ${entry.name}`} className={iconButton}>
                  <DownloadIcon size={18} aria-hidden />
                </a>
                <button type="button" onClick={() => setSharing(entry)} aria-label={`Partager ${entry.name}`} className={iconButton}>
                  <ShareIcon size={18} aria-hidden />
                </button>
                <button type="button" onClick={() => setDeleting(entry)} aria-label={`Supprimer ${entry.name}`} className={cn(iconButton, 'hover:text-error')}>
                  <TrashIcon size={18} aria-hidden />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {feedback && (
        <p role="status" className={cn('px-4 pb-3 text-footnote', feedback.ok ? 'text-success' : 'text-error')}>
          {feedback.message}
        </p>
      )}

      <ShareDialog key={sharing?.path ?? 'aucun'} target={sharing} onClose={() => setSharing(null)} />
      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={deleting?.kind === 'folder' ? 'Supprimer ce dossier ?' : 'Supprimer ce fichier ?'}
        description={
          <>
            <span className="break-all">{deleting?.name}</span>
            {deleting?.kind === 'folder' ? ' et tout son contenu seront effacés' : ' sera effacé'} du partage, définitivement. Les liens de partage qui y mènent seront révoqués.
          </>
        }
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Annuler
            </Button>
            <Button
              variant="danger"
              pending={pending}
              onClick={() =>
                deleting &&
                startTransition(async () => {
                  const result = await deletePathAction(deleting.path)
                  setFeedback(result)
                  setDeleting(null)
                  if (result.ok) router.refresh()
                })
              }
            >
              Supprimer
            </Button>
          </>
        }
      />
    </>
  )
}
