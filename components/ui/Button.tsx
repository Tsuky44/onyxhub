import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-quiet'

const VARIANTS: Record<Variant, string> = {
  // PROJECT_DESIGN.md §8 : blanc à 92 %, texte presque noir, pas d'ombre lourde.
  primary: 'bg-primary-fill text-on-primary hover:bg-text',
  secondary: 'border border-glass-border bg-glass-fill text-text hover:bg-hover',
  ghost: 'text-text-secondary hover:bg-glass-fill hover:text-text',
  // Une action qui détruit (suppression) : le rouge d'erreur, réservé à la confirmation.
  danger: 'bg-error text-text hover:bg-error/85',
  // Le bouton qui ouvre cette confirmation : secondaire, texte rouge.
  'danger-quiet': 'border border-glass-border bg-glass-fill text-error hover:bg-hover',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  /** Affiche l'attente et bloque les doubles envois. */
  pending?: boolean
}

/** L'apparence d'un bouton, pour un lien qui en joue le rôle (« Lire dans Onyx »). */
export function buttonClasses(variant: Variant = 'primary', className?: string): string {
  return cn(
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-card px-4 text-subhead font-semibold whitespace-nowrap',
    'transition-colors duration-(--motion-micro) ease-onyx disabled:cursor-not-allowed disabled:opacity-50',
    VARIANTS[variant],
    className,
  )
}

export function Button({ variant = 'primary', pending = false, className, children, disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={buttonClasses(variant, className)}
      {...rest}
    >
      {pending && <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />}
      {children}
    </button>
  )
}
