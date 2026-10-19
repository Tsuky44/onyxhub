import { cn } from '@/lib/cn'
import {
  AVAILABILITY_LABELS,
  AVAILABILITY_TONES,
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_TONES,
  type AvailabilityStatus,
  type RequestStatus,
  type StatusTone,
} from '@/lib/requests/status'

const TONES: Record<StatusTone, string> = {
  success: 'text-success',
  accent: 'text-accent-muted',
  warning: 'text-warning',
  neutral: 'text-text-secondary',
  error: 'text-error',
}

/**
 * Un statut : un point coloré et un mot, jamais la couleur seule. `overlay`
 * pose le badge sur une affiche, avec un fond assez opaque pour rester
 * lisible sur n'importe quelle image.
 */
export function Badge({ label, tone, overlay = false, className }: { label: string; tone: StatusTone; overlay?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-semibold whitespace-nowrap',
        overlay ? 'glass-strong border border-glass-border' : 'border border-glass-border bg-glass-fill',
        TONES[tone],
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  )
}

export function AvailabilityBadge({ status, overlay, className }: { status: AvailabilityStatus; overlay?: boolean; className?: string }) {
  const label = AVAILABILITY_LABELS[status]
  if (!label) return null
  return <Badge label={label} tone={AVAILABILITY_TONES[status]} overlay={overlay} className={className} />
}

export function RequestStatusBadge({ status, className }: { status: RequestStatus; className?: string }) {
  return <Badge label={REQUEST_STATUS_LABELS[status]} tone={REQUEST_STATUS_TONES[status]} className={className} />
}
