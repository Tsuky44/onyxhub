/** « Bonjour » jusqu'à 18 h, « Bonsoir » ensuite, comme on le dit ; « Bonne nuit » n'accueille personne. */
export function greeting(hour: number): string {
  return hour >= 18 || hour < 5 ? 'Bonsoir' : 'Bonjour'
}

/** Une durée longue lisible : « 3 j 4 h », « 5 h 12 min », « 42 min ». */
export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days} j ${hours % 24} h`
  if (hours > 0) return `${hours} h ${String(minutes % 60).padStart(2, '0')}`
  return `${minutes} min`
}

/** Une image d'affiche venue d'Onyx (TMDB ou fanart.tv), ramenée à une taille raisonnable quand c'est TMDB. */
export function onyxPoster(url: string | undefined, size = 'w185'): string | null {
  if (!url) return null
  if (url.startsWith('https://image.tmdb.org/t/p/')) return url.replace(/\/t\/p\/[^/]+\//, `/t/p/${size}/`)
  if (url.startsWith('https://assets.fanart.tv/')) return url
  return null
}
