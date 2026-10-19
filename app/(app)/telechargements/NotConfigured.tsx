import Link from 'next/link'
import type { Icon } from '@/lib/icons'

/** Un service de Téléchargements sans réglages : ce qui manque, et où le renseigner. */
export function NotConfigured({ icon: IconComponent, service, description }: { icon: Icon; service: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-panel border border-glass-border bg-surface px-6 py-16 text-center">
      <IconComponent size={32} className="text-text-muted" aria-hidden />
      <h2 className="mt-4 text-headline font-semibold text-text">{service} n’est pas configuré</h2>
      <p className="mt-1.5 max-w-md text-body text-pretty text-text-secondary">{description}</p>
      <Link
        href="/reglages"
        className="mt-5 inline-flex min-h-11 items-center rounded-card border border-glass-border bg-glass-fill px-4 text-subhead font-semibold text-text transition-colors duration-(--motion-micro) ease-onyx hover:bg-hover"
      >
        Ouvrir Réglages
      </Link>
    </div>
  )
}
