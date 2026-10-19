'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from 'react'
import { loadCatalogPage, type CatalogWire } from '@/app/(app)/demandes/actions'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { SearchIcon } from '@/lib/icons'
import type { CatalogItem, CatalogPage } from '@/lib/requests/catalog'
import { MediaCard } from './MediaCard'

/**
 * Une grille de médias à défilement infini. La page suivante se charge
 * avant d'atteindre le bas (marge de 1 000 px, comme MediaHub). En revenant
 * d'une fiche, la grille retrouve ses pages et sa position (sessionStorage,
 * 5 min) au lieu de repartir de la première page.
 */
interface Snapshot {
  items: CatalogItem[]
  page: number
  hasMore: boolean
  scrollY: number
  savedAt: number
}

const SNAPSHOT_TTL_MS = 5 * 60_000

function readSnapshot(key: string): Snapshot | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const snapshot = JSON.parse(raw) as Snapshot
    return Date.now() - snapshot.savedAt < SNAPSHOT_TTL_MS ? snapshot : null
  } catch {
    return null
  }
}

function writeSnapshot(key: string, snapshot: Omit<Snapshot, 'savedAt'>): void {
  try {
    sessionStorage.setItem(key, JSON.stringify({ ...snapshot, savedAt: Date.now() }))
  } catch {
    // Stockage plein ou interdit (navigation privée) : on perd seulement le retour à la position.
  }
}

export function CatalogGrid({
  source,
  initial,
  emptyTitle,
  emptyDescription,
}: {
  source: CatalogWire
  initial: CatalogPage
  emptyTitle: string
  emptyDescription: string
}) {
  const storageKey = `catalogue:${JSON.stringify(source)}`
  const [items, setItems] = useState(initial.items)
  const [page, setPage] = useState(initial.page)
  const [hasMore, setHasMore] = useState(initial.hasMore)
  const [error, setError] = useState<string | null>(null)
  const [loading, startLoading] = useTransition()
  const sentinel = useRef<HTMLDivElement>(null)
  const restoredScroll = useRef<number | null>(null)
  const state = useRef({ items, page, hasMore })
  useEffect(() => {
    state.current = { items, page, hasMore }
  })

  // Restauration avant le premier affichage : pas d'éclair de la première page.
  // Le serveur ne connaît pas le sessionStorage : on ne peut le lire qu'après
  // l'hydratation, d'où ces setState dans un effet, une seule fois par vue.
  useLayoutEffect(() => {
    const snapshot = readSnapshot(storageKey)
    if (!snapshot || snapshot.items.length <= initial.items.length) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(snapshot.items)
    setPage(snapshot.page)
    setHasMore(snapshot.hasMore)
    restoredScroll.current = snapshot.scrollY
  }, [storageKey, initial.items.length])

  useEffect(() => {
    if (restoredScroll.current === null) return
    window.scrollTo(0, restoredScroll.current)
    restoredScroll.current = null
  }, [items])

  // La position se mémorise au fil du défilement : un clic sur une carte navigue sans prévenir.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const save = () => {
      clearTimeout(timer)
      timer = setTimeout(() => writeSnapshot(storageKey, { ...state.current, scrollY: window.scrollY }), 200)
    }
    window.addEventListener('scroll', save, { passive: true })
    return () => {
      clearTimeout(timer)
      window.removeEventListener('scroll', save)
    }
  }, [storageKey])

  const loadMore = useCallback(() => {
    if (loading || !state.current.hasMore) return
    startLoading(async () => {
      const result = await loadCatalogPage(source, state.current.page + 1)
      if (!result.ok) {
        setError(result.message)
        return
      }
      setError(null)
      const seen = new Set(state.current.items.map((item) => `${item.mediaType}:${item.tmdbId}`))
      const fresh = result.page.items.filter((item) => !seen.has(`${item.mediaType}:${item.tmdbId}`))
      const next = { items: [...state.current.items, ...fresh], page: result.page.page, hasMore: result.page.hasMore }
      setItems(next.items)
      setPage(next.page)
      setHasMore(next.hasMore)
      writeSnapshot(storageKey, { ...next, scrollY: window.scrollY })
    })
  }, [loading, source, storageKey])

  useEffect(() => {
    const target = sentinel.current
    if (!target || !hasMore || error) return
    const observer = new IntersectionObserver((entries) => entries.some((entry) => entry.isIntersecting) && loadMore(), { rootMargin: '1000px' })
    observer.observe(target)
    return () => observer.disconnect()
  }, [hasMore, error, loadMore])

  if (items.length === 0) return <EmptyState icon={SearchIcon} title={emptyTitle} description={emptyDescription} />

  return (
    <div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 shell:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
        {items.map((item, index) => (
          <li key={`${item.mediaType}:${item.tmdbId}`}>
            <MediaCard item={item} priority={index < 6} />
          </li>
        ))}
      </ul>
      <div ref={sentinel} aria-hidden className="h-px" />
      <div aria-live="polite" className="flex min-h-20 items-center justify-center py-6">
        {loading && <span className="size-5 animate-spin rounded-full border-2 border-text-muted border-r-transparent" aria-label="Chargement" />}
        {error && !loading && (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-body text-text-secondary">{error}</p>
            <Button variant="secondary" onClick={loadMore}>
              Réessayer
            </Button>
          </div>
        )}
        {!hasMore && !loading && !error && items.length > 20 && <p className="text-footnote text-text-muted">Tu as tout vu.</p>}
      </div>
    </div>
  )
}
