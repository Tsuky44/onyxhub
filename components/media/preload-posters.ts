import { getImageProps } from 'next/image'
import { tmdbImageUrl, type PosterSize } from '@/lib/tmdb-image'

/**
 * Précharge les affiches d'un lot pas encore affiché, exactement comme
 * `Poster` les demandera : même `srcSet`, même `sizes`, donc la même variante
 * de l'optimiseur. Le navigateur la garde en cache et l'optimiseur l'a déjà
 * encodée : la carte s'affiche sans attente quand on l'atteint.
 *
 * Quatre à la fois, en priorité basse : sur un serveur HTTP/1.1 (six
 * connexions par hôte), les affiches visibles et le lot suivant passent
 * devant.
 */
const MAX_PARALLEL = 4
/** Au-delà, on oublie ce qui a déjà été préchargé : le cache du navigateur s'en souvient. */
const MAX_REMEMBERED = 2_000

type Job = { src: string; srcSet: string | undefined; sizes: string | undefined }

const waiting: Job[] = []
const known = new Set<string>()
let active = 0

function pump(): void {
  while (active < MAX_PARALLEL && waiting.length > 0) {
    const job = waiting.shift()!
    active++
    const image = new Image()
    image.fetchPriority = 'low'
    image.decoding = 'async'
    const done = () => {
      active--
      pump()
    }
    image.onload = done
    image.onerror = done
    // `sizes` avant `srcset` : le navigateur choisit la variante dès que `srcset` est posé.
    if (job.sizes) image.sizes = job.sizes
    if (job.srcSet) image.srcset = job.srcSet
    image.src = job.src
  }
}

export function preloadPosters(paths: readonly (string | null | undefined)[], { sizes, source = 'w500' }: { sizes: string; source?: PosterSize }): void {
  if (typeof window === 'undefined') return
  if (known.size > MAX_REMEMBERED) known.clear()
  for (const path of paths) {
    const url = tmdbImageUrl(path, source)
    if (!url || known.has(`${url}|${sizes}`)) continue
    known.add(`${url}|${sizes}`)
    const { props } = getImageProps({ src: url, alt: '', fill: true, sizes })
    waiting.push({ src: props.src, srcSet: props.srcSet, sizes: props.sizes })
  }
  pump()
}
