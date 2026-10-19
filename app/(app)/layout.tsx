import type { ReactNode } from 'react'
import { AppShell } from '@/components/shell/AppShell'
import { getViewer } from '@/lib/auth/viewer'

/** Les pages connectées. La connexion (phase 1) vit hors de ce groupe, sans shell. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const viewer = await getViewer()
  return <AppShell viewer={viewer}>{children}</AppShell>
}
