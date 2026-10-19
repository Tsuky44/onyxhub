/**
 * Mises en forme partagées par les pages et les messages des demandes.
 * Sans dépendance serveur : utilisable dans un composant client.
 */

/** « Saison 2 », « Saisons 1 à 4 », « Saisons 1, 3 et 5 », « Saisons 1 à 3 et 6 ». */
export function formatSeasons(seasons: readonly number[]): string {
  const sorted = [...new Set(seasons)].sort((a, b) => a - b)
  if (sorted.length === 0) return ''
  if (sorted.length === 1) return sorted[0] === 0 ? 'Épisodes spéciaux' : `Saison ${sorted[0]}`

  // Trois saisons consécutives ou plus deviennent « 1 à 4 » ; deux restent « 1 et 2 ».
  const parts: string[] = []
  let start = sorted[0]!
  let previous = start
  for (const season of [...sorted.slice(1), Number.NaN]) {
    if (season === previous + 1) {
      previous = season
      continue
    }
    if (previous - start >= 2) parts.push(`${start} à ${previous}`)
    else for (let number = start; number <= previous; number++) parts.push(String(number))
    start = season
    previous = season
  }
  const last = parts.pop()
  return `Saisons ${parts.length > 0 ? `${parts.join(', ')} et ${last}` : last}`
}

/** L'année d'une date TMDB (`2024-05-01`), ou rien. */
export function yearOf(date: string | null | undefined): string | null {
  return date && /^\d{4}/.test(date) ? date.slice(0, 4) : null
}

const RELATIVE = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })
const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

/** « il y a 3 heures », « hier », puis la date au-delà d'une semaine. */
export function formatRelative(date: Date, now = new Date()): string {
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 60) return 'à l\'instant'
  if (abs < 3600) return RELATIVE.format(Math.round(seconds / 60), 'minute')
  if (abs < 86_400) return RELATIVE.format(Math.round(seconds / 3600), 'hour')
  if (abs < 7 * 86_400) return RELATIVE.format(Math.round(seconds / 86_400), 'day')
  return DATE.format(date)
}

/** Une durée en minutes : « 2 h 15 », « 48 min ». */
export function formatRuntime(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} min`
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`
}

const UNITS = ['o', 'Ko', 'Mo', 'Go', 'To']

/** Une taille en octets, en unités binaires comme qBittorrent : « 1,4 Go ». */
export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '0 o'
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1)
  const value = bytes / 1024 ** exponent
  return `${value.toLocaleString('fr-FR', { maximumFractionDigits: value < 10 && exponent > 0 ? 1 : 0 })} ${UNITS[exponent]}`
}

/** Le segment d'URL d'un type de média : `/demandes/film/603`, `/demandes/serie/1399`. */
export const MEDIA_SLUGS = { movie: 'film', tv: 'serie' } as const

export function mediaHref(mediaType: 'movie' | 'tv', tmdbId: number): string {
  return `/demandes/${MEDIA_SLUGS[mediaType]}/${tmdbId}`
}
