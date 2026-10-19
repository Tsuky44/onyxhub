/**
 * L'URL d'une image TMDB à la bonne taille. MediaHub demandait `w500`
 * partout, y compris pour des vignettes de 120 px : on choisit ici la plus
 * petite taille qui couvre l'affichage. Sans dépendance serveur : utilisable
 * dans un composant client.
 */
export type PosterSize = 'w92' | 'w154' | 'w185' | 'w342' | 'w500' | 'w780' | 'original'
export type BackdropSize = 'w300' | 'w780' | 'w1280' | 'original'
export type ProfileSize = 'w45' | 'w185' | 'h632' | 'original'
export type LogoSize = 'w45' | 'w92' | 'w154' | 'w185' | 'original'

export type TmdbImageSize = PosterSize | BackdropSize | ProfileSize | LogoSize

const BASE = 'https://image.tmdb.org/t/p'

export function tmdbImageUrl(path: string | null | undefined, size: TmdbImageSize): string | null {
  if (!path || !path.startsWith('/')) return null
  return `${BASE}/${size}${path}`
}

/** La plus petite taille d'affiche dont la largeur couvre `cssWidth` px à la densité `dpr`. */
export function posterSizeFor(cssWidth: number, dpr = 2): PosterSize {
  const needed = cssWidth * dpr
  const steps: [number, PosterSize][] = [
    [92, 'w92'],
    [154, 'w154'],
    [185, 'w185'],
    [342, 'w342'],
    [500, 'w500'],
    [780, 'w780'],
  ]
  return steps.find(([width]) => width >= needed)?.[1] ?? 'original'
}
