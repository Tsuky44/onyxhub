import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/** Un choix à bascule (filtres, saisons) : l'état se lit à `aria-pressed`, pas seulement à la couleur. */
export function Chip({ pressed, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { pressed: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        'inline-flex min-h-11 shell:min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-subhead font-medium whitespace-nowrap',
        'transition-colors duration-(--motion-micro) ease-onyx disabled:cursor-not-allowed disabled:opacity-50',
        pressed ? 'border-text bg-text text-on-primary' : 'border-glass-border bg-glass-fill text-text-secondary hover:text-text',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
