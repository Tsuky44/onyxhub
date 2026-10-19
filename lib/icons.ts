/**
 * Les icônes de l'interface : Phosphor, comme les surfaces de navigation
 * d'Onyx (AppIcons). Tout passe par ce fichier, imposé par
 * tests/guards/icons.test.ts, pour qu'un changement de famille ou de poids
 * se fasse en un seul endroit.
 *
 * On importe l'entrée `/ssr` : ses composants ne lisent aucun contexte React,
 * donc ils s'affichent aussi bien dans un composant serveur que client.
 */
export {
  CalendarBlank as CalendarIcon,
  DownloadSimple as DownloadIcon,
  GearSix as SettingsIcon,
  House as HomeIcon,
  PlusCircle as RequestIcon,
  SignOut as SignOutIcon,
  Sparkle as ComingSoonIcon,
} from '@phosphor-icons/react/ssr'

export type { Icon } from '@phosphor-icons/react'
