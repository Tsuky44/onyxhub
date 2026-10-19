import type { Metadata } from 'next'
import Image from 'next/image'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { findShare, isExpired } from '@/lib/files/shares'
import { DownloadIcon, FolderIcon, MovieIcon } from '@/lib/icons'
import { baseName } from '@/lib/services/smb/paths'

export const metadata: Metadata = { title: 'Fichier partagé', robots: { index: false, follow: false } }

const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const ERRORS: Record<string, string> = {
  'mot-de-passe': 'Mot de passe incorrect.',
  essais: 'Trop d’essais. Réessaie dans quelques minutes.',
}

/**
 * La page publique d'un lien de partage : sans compte, sans script. Le
 * bouton télécharge directement (GET), ou envoie le mot de passe en POST.
 */
export default async function SharePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ erreur?: string }> }) {
  const { token } = await params
  const { erreur } = await searchParams
  const share = findShare(token)
  const available = share !== null && !isExpired(share)
  const error = erreur ? ERRORS[erreur] : undefined
  const Icon = share?.kind === 'folder' ? FolderIcon : MovieIcon
  const href = `/api/partage/${encodeURIComponent(token)}`

  return (
    <main className="login-backdrop flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <div className="mb-8 flex items-center gap-3">
        <Image src="/brand/onyx-mark.svg" alt="" width={40} height={40} priority />
        <Image src="/brand/onyx-wordmark.svg" alt="Onyx" width={77} height={18} priority />
        <span className="font-mono text-footnote font-medium tracking-wide text-text-secondary">HUB</span>
      </div>
      <div className="w-full max-w-sm rounded-modal border border-glass-border bg-surface p-6 shell:p-8">
        {!available ? (
          <>
            <h1 className="text-title2 font-bold tracking-[-0.01em] text-text">Lien indisponible</h1>
            <p className="mt-1 text-body text-text-secondary">Ce lien de partage n’existe pas ou a expiré. Demande un nouveau lien à la personne qui te l’a envoyé.</p>
          </>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-card bg-elevated text-text-secondary">
                <Icon size={22} aria-hidden />
              </span>
              <div className="min-w-0">
                <h1 className="text-headline font-semibold break-words text-text">{baseName(share.path, 'Partage')}</h1>
                <p className="mt-0.5 text-footnote text-text-muted">
                  {share.kind === 'folder' ? 'Dossier, téléchargé en ZIP' : 'Fichier'}
                  {share.expiresAt ? ` · disponible jusqu’au ${DATE.format(share.expiresAt)}` : ''}
                </p>
              </div>
            </div>
            {share.passwordHash ? (
              <form action={href} method="post" className="mt-6 flex flex-col gap-4">
                <TextField label="Mot de passe" name="motDePasse" type="password" autoComplete="off" required error={error} />
                <Button type="submit" className="w-full">
                  <DownloadIcon size={18} aria-hidden />
                  Télécharger
                </Button>
              </form>
            ) : (
              <a
                href={href}
                className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-card bg-primary-fill px-4 text-subhead font-semibold text-on-primary transition-colors duration-(--motion-micro) ease-onyx hover:bg-text"
              >
                <DownloadIcon size={18} aria-hidden />
                Télécharger
              </a>
            )}
          </>
        )}
      </div>
    </main>
  )
}
