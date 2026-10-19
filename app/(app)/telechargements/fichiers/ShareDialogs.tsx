'use client'

import { useRouter } from 'next/navigation'
import { useState, useSyncExternalStore, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Dialog } from '@/components/ui/Dialog'
import { TextField } from '@/components/ui/TextField'
import { cn } from '@/lib/cn'
import type { ShareDuration, ShareView } from '@/lib/files/shares'
import { CheckIcon, CopyIcon, FolderIcon, FileIcon, LockIcon, TrashIcon } from '@/lib/icons'
import { formatRelative } from '@/lib/requests/format'
import { createShareAction, revokeShareAction } from './actions'

const DURATIONS: { id: ShareDuration; label: string }[] = [
  { id: '1', label: '24 heures' },
  { id: '7', label: '7 jours' },
  { id: '30', label: '30 jours' },
  { id: '0', label: 'Sans limite' },
]

const noop = () => () => {}
/** L'adresse publique du lien, telle que le navigateur voit OnyxHub (derrière un proxy, c'est la bonne). */
function useShareUrl(token: string): string {
  const origin = useSyncExternalStore(
    noop,
    () => window.location.origin,
    () => '',
  )
  return `${origin}/partage/${token}`
}

function CopyField({ token }: { token: string }) {
  const url = useShareUrl(token)
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex gap-2">
      <input readOnly value={url} aria-label="Lien de partage" onFocus={(event) => event.currentTarget.select()} className="min-h-11 min-w-0 flex-1 rounded-card border border-border bg-elevated px-3 font-mono text-footnote text-text" />
      <Button
        variant="secondary"
        onClick={() =>
          navigator.clipboard.writeText(url).then(
            () => {
              setCopied(true)
              setTimeout(() => setCopied(false), 2_000)
            },
            () => setCopied(false),
          )
        }
        aria-label="Copier le lien"
      >
        {copied ? <CheckIcon size={16} aria-hidden /> : <CopyIcon size={16} aria-hidden />}
        <span className="hidden sm:inline">{copied ? 'Copié' : 'Copier'}</span>
      </Button>
    </div>
  )
}

/** Crée un lien public vers un fichier ou un dossier : durée, mot de passe facultatif, puis le lien à copier. */
export function ShareDialog({ target, onClose }: { target: { path: string; name: string } | null; onClose: () => void }) {
  const router = useRouter()
  const [duration, setDuration] = useState<ShareDuration>('7')
  const [password, setPassword] = useState('')
  const [created, setCreated] = useState<ShareView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      title={created ? 'Lien créé' : 'Partager'}
      description={<span className="break-all">{target?.name}</span>}
      size="sm"
      footer={
        created ? (
          <Button onClick={onClose}>Terminé</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button
              pending={pending}
              onClick={() =>
                target &&
                startTransition(async () => {
                  const result = await createShareAction({ path: target.path, duration, password })
                  if (!result.ok) {
                    setError(result.message)
                    return
                  }
                  setCreated(result.share)
                  router.refresh()
                })
              }
            >
              Créer le lien
            </Button>
          </>
        )
      }
    >
      {created ? (
        <div className="flex flex-col gap-3">
          <CopyField token={created.token} />
          <p className="text-footnote text-text-muted">
            {created.expiresAt ? `Valable jusqu’au ${new Date(created.expiresAt).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}` : 'Sans date d’expiration'}
            {created.hasPassword ? ' · protégé par mot de passe' : ''}. Révocable à tout moment depuis « Liens ».
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <fieldset>
            <legend className="mb-2 text-footnote font-medium text-text-secondary">Durée</legend>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((entry) => (
                <Chip key={entry.id} pressed={duration === entry.id} onClick={() => setDuration(entry.id)}>
                  {entry.label}
                </Chip>
              ))}
            </div>
          </fieldset>
          <TextField
            label="Mot de passe (facultatif)"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            help="Demandé avant le téléchargement. Il n’est pas gardé en clair."
            error={error ?? undefined}
          />
        </div>
      )}
    </Dialog>
  )
}

function ShareRow({ share }: { share: ShareView }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const Icon = share.kind === 'folder' ? FolderIcon : FileIcon
  return (
    <li className={cn('flex flex-col gap-2 py-3', share.expired && 'opacity-60')}>
      <div className="flex items-start gap-3">
        <Icon size={20} aria-hidden className="mt-0.5 shrink-0 text-text-muted" />
        <div className="min-w-0 flex-1">
          <p className="text-subhead font-semibold break-all text-text">{share.name}</p>
          <p className="text-footnote break-all text-text-muted">{share.path}</p>
          <p className="mt-1 flex flex-wrap gap-x-3 text-footnote text-text-secondary">
            <span>{share.expired ? 'Expiré' : share.expiresAt ? `Expire ${formatRelative(new Date(share.expiresAt))}` : 'Sans expiration'}</span>
            {share.hasPassword && (
              <span className="inline-flex items-center gap-1">
                <LockIcon size={12} aria-hidden />
                Mot de passe
              </span>
            )}
            <span>
              {share.downloads} téléchargement{share.downloads > 1 ? 's' : ''}
            </span>
            <span>par {share.createdBy}</span>
          </p>
        </div>
        <Button
          variant="danger-quiet"
          pending={pending}
          aria-label={`Révoquer le lien vers ${share.name}`}
          onClick={() =>
            startTransition(async () => {
              const result = await revokeShareAction(share.id)
              if (result.ok) router.refresh()
              else setError(result.message)
            })
          }
        >
          <TrashIcon size={16} aria-hidden />
        </Button>
      </div>
      {!share.expired && <CopyField token={share.token} />}
      {error && <p className="text-footnote text-error">{error}</p>}
    </li>
  )
}

/** Tous les liens de partage : copier, voir l'usage, révoquer. */
export function SharesButton({ shares }: { shares: ShareView[] }) {
  const [open, setOpen] = useState(false)
  const active = shares.filter((share) => !share.expired).length
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Liens
        <span className="font-mono text-text-secondary">{active}</span>
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Liens de partage" description="Chaque lien donne accès à un seul fichier ou dossier, sans compte." size="lg">
        {shares.length === 0 ? (
          <p className="text-body text-text-secondary">Aucun lien. Partage un fichier depuis la liste.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-glass-border">
            {shares.map((share) => (
              <ShareRow key={share.id} share={share} />
            ))}
          </ul>
        )}
      </Dialog>
    </>
  )
}
