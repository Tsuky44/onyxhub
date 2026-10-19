'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { CloseIcon } from '@/lib/icons'

/**
 * Une modale sur l'élément `<dialog>` natif : le navigateur gère le piège du
 * focus, Échap et le retour du focus au bouton d'origine. Verre niveau 2,
 * rayon 24 (PROJECT_DESIGN.md §8). En téléphone, elle monte du bas.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        // Un clic sur le voile (le <dialog> lui-même, hors du panneau) ferme.
        if (event.target === event.currentTarget) onClose()
      }}
      aria-labelledby={titleId}
      className={cn(
        'glass-strong m-0 mt-auto w-full max-w-none rounded-t-modal border border-glass-border p-0 text-text shadow-float',
        'backdrop:bg-glass-strong backdrop:backdrop-blur-sm',
        'shell:m-auto shell:rounded-modal',
        size === 'sm' && 'shell:max-w-md',
        size === 'md' && 'shell:max-w-xl',
        size === 'lg' && 'shell:max-w-3xl',
        size === 'xl' && 'shell:max-w-5xl',
      )}
    >
      {open && (
        <div className="flex max-h-[85dvh] flex-col">
          <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-title3 font-bold text-balance">
                {title}
              </h2>
              {description && <div className="mt-1 text-body text-pretty text-text-secondary">{description}</div>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="-mt-1 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-text-secondary transition-colors duration-(--motion-micro) ease-onyx hover:bg-glass-fill hover:text-text"
            >
              <CloseIcon size={20} aria-hidden />
            </button>
          </div>
          {children && <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">{children}</div>}
          {footer && (
            <div className="flex flex-col-reverse gap-2 border-t border-glass-border px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shell:flex-row shell:justify-end shell:pb-4">
              {footer}
            </div>
          )}
        </div>
      )}
    </dialog>
  )
}
