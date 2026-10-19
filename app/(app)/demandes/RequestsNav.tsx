import Link from 'next/link'
import { cn } from '@/lib/cn'

/** Les deux faces de Demandes : trouver un média, suivre les demandes. */
export function RequestsNav({ current }: { current: 'decouvrir' | 'liste' }) {
  const tabs = [
    { id: 'decouvrir', label: 'Découvrir', href: '/demandes' },
    { id: 'liste', label: 'Suivi des demandes', href: '/demandes/liste' },
  ] as const
  return (
    <nav aria-label="Demandes" className="inline-flex rounded-full border border-glass-border bg-surface p-1">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          aria-current={current === tab.id ? 'page' : undefined}
          className={cn(
            'inline-flex min-h-11 shell:min-h-10 items-center rounded-full px-4 text-subhead whitespace-nowrap transition-colors duration-(--motion-micro) ease-onyx',
            current === tab.id ? 'bg-elevated font-semibold text-text' : 'font-medium text-text-secondary hover:text-text',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}
