import type { ReactNode } from 'react'
import type { Viewer } from '@/lib/auth/viewer'
import { AccountChip } from './AccountChip'
import { Brand } from './Brand'
import { MobileBottomNav } from './MobileBottomNav'
import { NavTabs } from './NavTabs'

/**
 * Le cadre de toutes les pages connectées : header de verre au-delà de 900 px,
 * barre du haut sobre et barre du bas en deçà, comme le shell d'Onyx.
 */
export function AppShell({ viewer, children }: { viewer: Viewer; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-card focus:bg-elevated focus:px-4 focus:py-2 focus:text-subhead"
      >
        Aller au contenu
      </a>

      <header className="glass sticky top-0 z-40 hidden border-b border-glass-border shell:block">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-5 px-7">
          <Brand />
          <div className="min-w-0 flex-1">
            <NavTabs isAdmin={viewer.isAdmin} />
          </div>
          <AccountChip viewer={viewer} />
        </div>
      </header>

      <header className="flex h-14 items-center justify-between px-5 shell:hidden">
        <Brand />
        <AccountChip viewer={viewer} compact />
      </header>

      <main
        id="contenu"
        className="mx-auto w-full max-w-[1440px] flex-1 px-5 pt-6 pb-[calc(5rem+env(safe-area-inset-bottom))] shell:px-12 shell:pt-10 shell:pb-16 xl:px-20"
      >
        {children}
      </main>

      <MobileBottomNav isAdmin={viewer.isAdmin} />
    </div>
  )
}
