import { logoutAction } from '@/lib/auth/actions'
import type { Viewer } from '@/lib/auth/viewer'
import { cn } from '@/lib/cn'
import { SignOutIcon } from '@/lib/icons'

/**
 * Le compte connecté et son menu. Le menu est un `popover` natif : fermeture
 * au clic extérieur et à Échap, focus géré par le navigateur, sans une ligne
 * de JavaScript ni un composant client.
 */
export function AccountChip({ viewer, compact = false }: { viewer: Viewer; compact?: boolean }) {
  const initial = viewer.name.trim().charAt(0).toUpperCase() || '?'
  const menuId = compact ? 'menu-compte-mobile' : 'menu-compte'
  return (
    <div className="shrink-0">
      <button
        type="button"
        popoverTarget={menuId}
        aria-label={`Compte de ${viewer.name}`}
        className="flex min-h-11 items-center gap-2.5 rounded-card px-1 transition-colors duration-(--motion-micro) ease-onyx hover:bg-glass-fill"
      >
        {!compact && (
          <span className="flex flex-col items-end leading-tight">
            <span className="text-subhead font-semibold text-text">{viewer.name}</span>
            {viewer.isAdmin && <span className="font-mono text-micro tracking-wider text-text-muted">ADMIN</span>}
          </span>
        )}
        <span
          aria-hidden
          className="flex size-9 items-center justify-center rounded-full border border-glass-border bg-elevated text-subhead font-semibold text-text"
        >
          {initial}
        </span>
      </button>

      <div
        id={menuId}
        popover="auto"
        className={cn(
          'glass-strong fixed inset-auto m-0 w-60 rounded-panel border border-glass-border p-1.5 text-text shadow-float',
          compact ? 'top-14 right-4' : 'top-16 right-6',
        )}
      >
        <div className="px-3 py-2">
          <p className="truncate text-subhead font-semibold">{viewer.name}</p>
          <p className="text-footnote text-text-muted">
            {viewer.isOwner ? 'Propriétaire du serveur' : viewer.isAdmin ? 'Admin' : 'Membre'}
          </p>
        </div>
        <div className="my-1 h-px bg-glass-border" />
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex min-h-11 w-full items-center gap-2.5 rounded-card px-3 text-subhead text-text-secondary transition-colors duration-(--motion-micro) ease-onyx hover:bg-glass-fill hover:text-text"
          >
            <SignOutIcon size={18} aria-hidden />
            Se déconnecter
          </button>
        </form>
      </div>
    </div>
  )
}
