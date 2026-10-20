import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
// Polices embarquées, comme l'app Onyx (ADR-0025) : rien ne part vers Google
// Fonts au build ni à l'affichage.
import '@fontsource-variable/manrope'
import '@fontsource-variable/geist-mono'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'OnyxHub', template: '%s · OnyxHub' },
  description: 'Demandes, calendrier et téléchargements de ton serveur Onyx.',
}

export const viewport: Viewport = {
  themeColor: '#1c1d22',
  colorScheme: 'dark',
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
