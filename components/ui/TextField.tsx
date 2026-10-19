import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string
  help?: ReactNode
  error?: string
  /** Élément posé à droite du libellé (badge « enregistré », « verrouillé »…). */
  aside?: ReactNode
}

/** Un champ de formulaire : surface élevée, liseré, bordure accent au focus (PROJECT_DESIGN.md §8). */
export function TextField({ label, help, error, aside, className, ...input }: TextFieldProps) {
  const id = useId()
  const helpId = `${id}-aide`
  const errorId = `${id}-erreur`
  const describedBy = [help ? helpId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-footnote font-medium text-text-secondary">
          {label}
        </label>
        {aside}
      </div>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'min-h-11 w-full rounded-card border bg-elevated px-3.5 text-body text-text placeholder:text-text-muted',
          'transition-colors duration-(--motion-micro) ease-onyx outline-none',
          'focus:border-accent disabled:cursor-not-allowed disabled:opacity-60',
          error ? 'border-error' : 'border-border hover:border-text-muted',
        )}
        {...input}
      />
      {help && !error && (
        <p id={helpId} className="text-footnote text-text-muted">
          {help}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-footnote text-error">
          {error}
        </p>
      )}
    </div>
  )
}
