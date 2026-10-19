'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/cn'
import { isActive, navItemsFor } from '@/lib/navigation'

/**
 * Les onglets du header desktop. L'onglet affiché se lit à son texte en gras
 * et à un trait blanc court dessous (PROJECT_DESIGN.md §8) : une pilule pleine
 * ferait bouton de formulaire.
 */
export function NavTabs({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Navigation principale" className="flex min-w-0 items-center gap-1 overflow-x-auto">
      {navItemsFor(isAdmin).map((item) => {
        const active = isActive(item.href, pathname)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-col items-center rounded-panel px-3 pt-[7px] pb-[5px] text-subhead whitespace-nowrap',
              'transition-colors duration-(--motion-micro) ease-onyx',
              active ? 'font-bold text-text' : 'font-medium text-text-secondary hover:text-text',
            )}
          >
            {item.label}
            <span
              aria-hidden
              className={cn(
                'mt-1 h-0.5 w-4 rounded-full bg-text transition-opacity duration-(--motion-micro) ease-onyx',
                active ? 'opacity-100' : 'opacity-0',
              )}
            />
          </Link>
        )
      })}
    </nav>
  )
}
