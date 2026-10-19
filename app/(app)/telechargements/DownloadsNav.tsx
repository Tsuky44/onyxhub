import Link from 'next/link'
import { cn } from '@/lib/cn'

const TABS = [
  { id: 'torrents', label: 'Torrents', href: '/telechargements' },
  { id: 'recherche', label: 'Recherche', href: '/telechargements/recherche' },
  { id: 'fichiers', label: 'Fichiers', href: '/telechargements/fichiers' },
] as const

/** Les trois faces de Téléchargements : qBittorrent, recherche Prowlarr, fichiers SMB. */
export function DownloadsNav({ current }: { current: (typeof TABS)[number]['id'] }) {
  return (
    <nav aria-label="Téléchargements" className="inline-flex rounded-full border border-glass-border bg-surface p-1">
      {TABS.map((tab) => (
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
