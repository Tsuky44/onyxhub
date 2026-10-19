import Image from 'next/image'
import Link from 'next/link'

/**
 * La marque d'Onyx (lentille + wordmark dessiné de `brand/`), suivie de
 * « HUB » en Geist Mono : le nom se lit comme une pièce d'Onyx, pas comme
 * une app à part.
 */
export function Brand() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2.5 rounded-card" aria-label="OnyxHub, accueil">
      <Image src="/brand/onyx-mark.svg" alt="" width={28} height={28} priority />
      <Image src="/brand/onyx-wordmark.svg" alt="" width={51} height={12} className="h-3 w-auto" priority />
      <span className="font-mono text-caption font-medium tracking-wide text-text-secondary">HUB</span>
    </Link>
  )
}
