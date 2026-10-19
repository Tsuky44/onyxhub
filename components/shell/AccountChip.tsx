import type { Viewer } from '@/lib/auth/viewer'

/** Le compte connecté. La phase 1 y accroche le menu (déconnexion). */
export function AccountChip({ viewer, compact = false }: { viewer: Viewer; compact?: boolean }) {
  const initial = viewer.name.trim().charAt(0).toUpperCase() || '?'
  return (
    <div className="flex shrink-0 items-center gap-2.5">
      {!compact && (
        <div className="flex flex-col items-end leading-tight">
          <span className="text-subhead font-semibold text-text">{viewer.name}</span>
          {viewer.isAdmin && <span className="font-mono text-micro tracking-wider text-text-muted">ADMIN</span>}
        </div>
      )}
      <span
        aria-hidden
        className="flex size-9 items-center justify-center rounded-full border border-glass-border bg-elevated text-subhead font-semibold text-text"
      >
        {initial}
      </span>
    </div>
  )
}
