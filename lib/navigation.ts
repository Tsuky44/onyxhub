import { CalendarIcon, DownloadIcon, HomeIcon, RequestIcon, SettingsIcon, type Icon } from '@/lib/icons'

export interface NavItem {
  href: string
  label: string
  /** Libellé de la barre du bas mobile, où cinq onglets se partagent 375 px. */
  shortLabel?: string
  icon: Icon
  /** Réservé aux comptes Onyx qui ont `manage_settings`. */
  adminOnly: boolean
}

/** Les onglets du shell, dans l'ordre d'affichage (PLAN.md §3). */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', label: 'Accueil', icon: HomeIcon, adminOnly: false },
  { href: '/demandes', label: 'Demandes', icon: RequestIcon, adminOnly: false },
  { href: '/calendrier', label: 'Calendrier', icon: CalendarIcon, adminOnly: false },
  { href: '/telechargements', label: 'Téléchargements', shortLabel: 'Transferts', icon: DownloadIcon, adminOnly: true },
  { href: '/reglages', label: 'Réglages', icon: SettingsIcon, adminOnly: true },
]

export function navItemsFor(isAdmin: boolean): NavItem[] {
  return NAV_ITEMS.filter((item) => isAdmin || !item.adminOnly)
}

/**
 * L'onglet actif pour un chemin : l'accueil seulement sur `/`, les autres
 * aussi sur leurs sous-pages (`/demandes/movie/42` allume « Demandes »).
 */
export function isActive(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}
