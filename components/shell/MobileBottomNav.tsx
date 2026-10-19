'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/cn'
import { isActive, navItemsFor } from '@/lib/navigation'

/**
 * La barre du bas des petits écrans, comme celle d'Onyx : l'onglet affiché a
 * son icône pleine et son libellé en blanc, l'accent restant réservé au focus
 * et à la progression.
 */
export function MobileBottomNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Navigation principale"
      className="glass fixed inset-x-0 bottom-0 z-40 border-t border-glass-border pb-[env(safe-area-inset-bottom)] shell:hidden"
    >
      <ul className="mx-auto flex max-w-xl items-stretch justify-around px-2">
        {navItemsFor(isAdmin).map((item) => {
          const active = isActive(item.href, pathname)
          const Icon = item.icon
          return (
            <li key={item.href} className="min-w-0 flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-card text-caption',
                  'transition-colors duration-(--motion-micro) ease-onyx',
                  active ? 'font-semibold text-text' : 'font-medium text-text-muted',
                )}
              >
                <Icon size={24} weight={active ? 'fill' : 'regular'} aria-hidden />
                <span className="max-w-full truncate px-0.5">{item.shortLabel ?? item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
