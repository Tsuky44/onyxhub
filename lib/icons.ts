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
  ArrowClockwise as RefreshIcon,
  ArrowLeft as BackIcon,
  ArrowSquareOut as ExternalIcon,
  ArrowsClockwise as SyncIcon,
  BookmarkSimple as WatchLaterIcon,
  CalendarBlank as CalendarIcon,
  CaretDown as ChevronDownIcon,
  CaretLeft as ChevronLeftIcon,
  CaretRight as ChevronRightIcon,
  Check as CheckIcon,
  CheckCircle as SuccessIcon,
  Compass as DiscoverIcon,
  Copy as CopyIcon,
  DownloadSimple as DownloadIcon,
  FilmStrip as MovieIcon,
  GearSix as SettingsIcon,
  House as HomeIcon,
  Lightning as AutoSearchIcon,
  ListBullets as ListIcon,
  ListMagnifyingGlass as InteractiveSearchIcon,
  MagnifyingGlass as SearchIcon,
  Play as PlayIcon,
  PlusCircle as RequestIcon,
  SignOut as SignOutIcon,
  SlidersHorizontal as FilterIcon,
  Sparkle as ComingSoonIcon,
  Star as StarIcon,
  Television as ShowIcon,
  Trash as TrashIcon,
  User as PersonIcon,
  WarningCircle as WarningIcon,
  Wrench as ManageIcon,
  X as CloseIcon,
} from '@phosphor-icons/react/ssr'

export type { Icon } from '@phosphor-icons/react'
