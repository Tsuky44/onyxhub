import type { DownloadProgress } from './downloads'

/**
 * La barre de téléchargement entre deux mesures. sorraa ne relève qBittorrent
 * que toutes les 10 s : afficher chaque mesure telle quelle fait avancer la
 * barre par bonds. Le navigateur prolonge donc la dernière mesure à la vitesse
 * qu'elle annonce, seconde par seconde, sans rien demander de plus au serveur.
 */

/** Au-delà, la mesure est trop vieille pour être prolongée : la barre attend la suivante. */
const MAX_EXTRAPOLATION_MS = 30_000
/** Seul le client de téléchargement dit qu'un téléchargement est fini. */
const CEILING = 99.9
/** Un recul plus grand est réel (release remplacée, revérification) ; un plus petit est l'estimation qui a pris de l'avance. */
const REAL_SETBACK = 5

/** Ce qu'un téléchargement a probablement fait `elapsedMs` après sa mesure. Pure. */
export function estimate(download: DownloadProgress, elapsedMs: number): DownloadProgress {
  if (download.stalled || !download.speed || download.size <= 0 || download.progress >= 100) return download
  const seconds = Math.min(Math.max(0, elapsedMs), MAX_EXTRAPOLATION_MS) / 1000
  const gained = Math.min(download.speed * seconds, download.sizeLeft)
  return {
    ...download,
    progress: Math.min(CEILING, download.progress + (gained / download.size) * 100),
    sizeLeft: Math.round(download.sizeLeft - gained),
    eta: download.eta === null ? null : Math.max(0, Math.round(download.eta - seconds)),
  }
}

/**
 * Ce que la barre montre ensuite (`stepMs` après l'affichage précédent) :
 * l'estimation, sauf si elle ferait reculer la barre d'un peu, quand la
 * vitesse a baissé depuis la mesure d'avant. La barre ralentit alors à
 * demi-allure jusqu'à ce que l'estimation la rattrape : ni recul, ni arrêt net
 * (mesuré : un arrêt dure jusqu'à 7 s sur un débit qui varie de ±30 %). Pure.
 */
export function advance(
  shown: Readonly<Record<string, DownloadProgress>>,
  measured: Readonly<Record<string, DownloadProgress>>,
  elapsedMs: number,
  stepMs = 1_000,
): Record<string, DownloadProgress> {
  const next: Record<string, DownloadProgress> = {}
  for (const [key, download] of Object.entries(measured)) {
    const guess = estimate(download, elapsedMs)
    const previous = shown[key]
    const setback = previous ? previous.progress - guess.progress : 0
    // En pause, la barre n'a plus rien pour rattraper : elle dit la mesure.
    if (!previous || setback <= 0 || setback >= REAL_SETBACK || guess.stalled) {
      next[key] = guess
      continue
    }
    const pace = guess.progress - estimate(download, elapsedMs - stepMs).progress
    next[key] = { ...guess, progress: Math.min(CEILING, previous.progress + pace / 2) }
  }
  return next
}

/** Un téléchargement que la barre doit faire avancer seule. */
export const isMoving = (download: DownloadProgress): boolean => !download.stalled && (download.speed ?? 0) > 0 && download.progress < 100

/** Le pourcentage affiché : une décimale, à la française. */
export const formatPercent = (progress: number): string => `${(Math.floor(progress * 10) / 10).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`

export function formatEta(seconds: number | null): string | null {
  if (seconds === null) return null
  if (seconds < 60) return "moins d'une minute"
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  return `${hours} h ${String(minutes % 60).padStart(2, '0')}`
}
