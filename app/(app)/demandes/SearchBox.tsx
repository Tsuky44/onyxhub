'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { CloseIcon, SearchIcon } from '@/lib/icons'
import { discoverHref, parseDiscoverQuery } from '@/lib/requests/discover-query'

/**
 * La recherche TMDB. Elle met l'URL à jour pendant la frappe (après une
 * courte pause) sans empiler l'historique, et garde la vue courante.
 */
export function SearchBox({ search }: { search: string }) {
  const router = useRouter()
  const current = parseDiscoverQuery(new URLSearchParams(search))
  const [value, setValue] = useState(current.query)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  function go(query: string) {
    clearTimeout(timer.current)
    const view = current.view === 'plus-tard' || current.view === 'pour-toi' ? 'tout' : current.view
    router.replace(discoverHref({ ...current, view, query: query.trim() }), { scroll: false })
  }

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault()
        go(value)
      }}
      className="relative w-full shell:max-w-md"
    >
      <SearchIcon size={18} aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-text-muted" />
      <input
        type="search"
        value={value}
        onChange={(event) => {
          const next = event.target.value
          setValue(next)
          clearTimeout(timer.current)
          timer.current = setTimeout(() => go(next), 450)
        }}
        placeholder="Un film, une série…"
        aria-label="Rechercher un film ou une série"
        enterKeyHint="search"
        className="min-h-11 w-full rounded-full border border-border bg-elevated pr-11 pl-10 text-body text-text placeholder:text-text-muted outline-none transition-colors duration-(--motion-micro) ease-onyx hover:border-text-muted focus:border-accent [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            setValue('')
            go('')
          }}
          aria-label="Effacer la recherche"
          className="absolute top-1/2 right-1 flex size-11 shell:size-10 -translate-y-1/2 items-center justify-center rounded-full text-text-muted hover:text-text"
        >
          <CloseIcon size={16} aria-hidden />
        </button>
      )}
    </form>
  )
}
