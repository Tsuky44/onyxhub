import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { ChevronRightIcon } from '@/lib/icons'

/** Un bloc de tableau de bord : surface, titre, lien « Tout voir » facultatif. */
export function Panel({
  title,
  href,
  hrefLabel = 'Tout voir',
  aside,
  children,
  className,
}: {
  title: string
  href?: string
  hrefLabel?: string
  aside?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('flex min-w-0 flex-col rounded-panel border border-glass-border bg-surface p-5', className)}>
      <div className="mb-4 flex min-h-8 items-center justify-between gap-3">
        <h2 className="text-headline font-semibold text-text">{title}</h2>
        {aside}
        {href && (
          <Link href={href} className="-my-2 inline-flex min-h-11 shrink-0 items-center gap-1 text-subhead font-medium text-text-secondary hover:text-text">
            {hrefLabel}
            <ChevronRightIcon size={14} aria-hidden />
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

/** Un chiffre clé : libellé discret, valeur en Geist Mono. */
export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'success' | 'warning' | 'error' }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-footnote text-text-muted">{label}</p>
      <p
        className={cn(
          'mt-0.5 truncate font-mono text-title3 font-semibold',
          tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : tone === 'error' ? 'text-error' : 'text-text',
        )}
      >
        {value}
      </p>
      {hint && <p className="truncate text-footnote text-text-secondary">{hint}</p>}
    </div>
  )
}

/**
 * Une barre de progression fine : l'accent, seul usage plein de la couleur.
 * Le remplissage glisse (`transform`, sans recalcul de mise en page) : une
 * barre mise à jour chaque seconde avance d'un mouvement continu.
 */
export function ProgressBar({
  value,
  label,
  tone = 'accent',
  className,
}: {
  value: number
  label: string
  tone?: 'accent' | 'warning' | 'error'
  className?: string
}) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      aria-label={label}
      className={cn('h-1.5 overflow-hidden rounded-full bg-elevated', className)}
    >
      <div
        className={cn(
          'h-full w-full rounded-full transition-[transform,background-color] duration-(--motion-emphasis) ease-onyx',
          tone === 'warning' ? 'bg-warning' : tone === 'error' ? 'bg-error' : 'bg-accent',
        )}
        style={{ transform: `translateX(${clamped - 100}%)` }}
      />
    </div>
  )
}

/** Le squelette d'un bloc pendant son chargement, à la hauteur approximative du contenu. */
export function PanelSkeleton({ title, rows = 3, className }: { title: string; rows?: number; className?: string }) {
  return (
    <section aria-busy className={cn('rounded-panel border border-glass-border bg-surface p-5', className)}>
      <h2 className="mb-4 text-headline font-semibold text-text">{title}</h2>
      <div aria-hidden className="flex flex-col gap-3">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="h-12 animate-pulse rounded-card bg-elevated" />
        ))}
      </div>
    </section>
  )
}

/** Ce qu'un bloc dit quand son service ne répond pas, sans casser le reste de la page. */
export function PanelError({ message }: { message: string }) {
  return <p className="rounded-card border border-glass-border bg-glass-fill px-4 py-3 text-body text-text-secondary">{message}</p>
}
