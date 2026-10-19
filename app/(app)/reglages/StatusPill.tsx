import { cn } from '@/lib/cn'
import type { ServiceStatus } from '@/lib/settings/status'

const LABELS: Record<ServiceStatus, { label: string; tone: string }> = {
  configured: { label: 'Configuré', tone: 'text-success' },
  partial: { label: 'Incomplet', tone: 'text-warning' },
  empty: { label: 'Non configuré', tone: 'text-text-muted' },
}

/** Pastille d'état : un point coloré et un mot, jamais la couleur seule. */
export function StatusPill({ status }: { status: ServiceStatus }) {
  const { label, tone } = LABELS[status]
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full border border-glass-border px-2.5 py-1 text-footnote font-medium', tone)}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  )
}
