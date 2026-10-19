import Image from 'next/image'
import { cn } from '@/lib/cn'
import { MovieIcon } from '@/lib/icons'
import { tmdbImageUrl, type PosterSize } from '@/lib/tmdb-image'

/**
 * Une affiche au ratio 2:3 fixe : la place est réservée avant le chargement,
 * rien ne saute. `sizes` dit au navigateur la largeur affichée, pour que
 * next/image serve la plus petite variante AVIF/WebP qui suffit.
 */
export function Poster({
  path,
  title,
  sizes,
  source = 'w500',
  priority = false,
  className,
}: {
  path: string | null | undefined
  title: string
  sizes: string
  /** La taille TMDB d'origine, que next/image réduit ensuite. */
  source?: PosterSize
  priority?: boolean
  className?: string
}) {
  const src = tmdbImageUrl(path, source)
  return (
    <div className={cn('relative aspect-[2/3] overflow-hidden rounded-card bg-elevated', className)}>
      {src ? (
        <Image src={src} alt="" fill sizes={sizes} priority={priority} className="object-cover" />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-2 p-3 text-center text-text-muted">
          <MovieIcon size={28} aria-hidden />
          <span className="line-clamp-3 text-footnote">{title}</span>
        </div>
      )}
    </div>
  )
}
