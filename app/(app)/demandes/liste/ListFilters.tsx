'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Chip } from '@/components/ui/Chip'
import { CloseIcon, SearchIcon } from '@/lib/icons'
import { REQUEST_STATUS_LABELS, REQUEST_STATUSES } from '@/lib/requests/status'

const TYPES = [
  ['', 'Tout'],
  ['film', 'Films'],
  ['serie', 'Séries'],
] as const

const OWNERS = [
  ['', 'Tout le monde'],
  ['moi', 'Les miennes'],
  ['autres', 'Les autres'],
] as const

/** Les filtres de la liste, dans l'URL : type, demandeur, statut et recherche (titre ou demandeur). */
export function ListFilters({ search }: { search: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = new URLSearchParams(search)
  const [query, setQuery] = useState(params.get('q') ?? '')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  function set(name: string, value: string, replace = false) {
    const next = new URLSearchParams(search)
    if (value) next.set(name, value)
    else next.delete(name)
    const href = next.toString() ? `${pathname}?${next}` : pathname
    if (replace) router.replace(href, { scroll: false })
    else router.push(href, { scroll: false })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 shell:flex-row shell:items-center">
        <div role="search" className="relative w-full shell:max-w-sm">
          <SearchIcon size={18} aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-text-muted" />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              const value = event.target.value
              setQuery(value)
              clearTimeout(timer.current)
              timer.current = setTimeout(() => set('q', value.trim(), true), 400)
            }}
            placeholder="Titre ou demandeur"
            aria-label="Rechercher dans les demandes"
            className="min-h-11 w-full rounded-full border border-border bg-elevated pr-11 pl-10 text-body text-text placeholder:text-text-muted outline-none transition-colors duration-(--motion-micro) ease-onyx hover:border-text-muted focus:border-accent [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              aria-label="Effacer la recherche"
              onClick={() => {
                setQuery('')
                set('q', '', true)
              }}
              className="absolute top-1/2 right-1 flex size-10 -translate-y-1/2 items-center justify-center rounded-full text-text-muted hover:text-text"
            >
              <CloseIcon size={16} aria-hidden />
            </button>
          )}
        </div>
        <label className="flex items-center gap-3 text-footnote font-medium text-text-secondary">
          Statut
          <select
            value={params.get('statut') ?? ''}
            onChange={(event) => set('statut', event.target.value)}
            className="min-h-11 rounded-full border border-border bg-elevated px-4 text-body text-text outline-none focus:border-accent"
          >
            <option value="">Tous</option>
            {REQUEST_STATUSES.map((status) => (
              <option key={status} value={status}>
                {REQUEST_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <div role="group" aria-label="Type" className="flex flex-wrap gap-2">
          {TYPES.map(([value, label]) => (
            <Chip key={value || 'tout'} pressed={(params.get('type') ?? '') === value} onClick={() => set('type', value)}>
              {label}
            </Chip>
          ))}
        </div>
        <span aria-hidden className="mx-1 hidden w-px self-stretch bg-border sm:block" />
        <div role="group" aria-label="Demandeur" className="flex flex-wrap gap-2">
          {OWNERS.map(([value, label]) => (
            <Chip key={value || 'tous'} pressed={(params.get('demandeur') ?? '') === value} onClick={() => set('demandeur', value)}>
              {label}
            </Chip>
          ))}
        </div>
      </div>
    </div>
  )
}
