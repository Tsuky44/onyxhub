'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState, useTransition, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Dialog } from '@/components/ui/Dialog'
import { FilterIcon } from '@/lib/icons'
import {
  activeFilterCount,
  DEFAULT_REGION,
  DEFAULT_SORT,
  discoverHref,
  LANGUAGES,
  parseDiscoverQuery,
  REGIONS,
  SORT_OPTIONS,
  type DiscoverQuery,
} from '@/lib/requests/discover-query'
import type { MediaType, TmdbGenre, TmdbWatchProvider } from '@/lib/services/tmdb/types'
import { tmdbImageUrl } from '@/lib/tmdb-image'
import { loadWatchProviders } from './actions'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="border-t border-glass-border py-5 first:border-t-0 first:pt-0">
      <legend className="sr-only">{title}</legend>
      <p aria-hidden className="mb-3 text-footnote font-semibold tracking-wide text-text-muted uppercase">
        {title}
      </p>
      {children}
    </fieldset>
  )
}

function toggle(list: readonly number[] | undefined, id: number): number[] {
  const current = list ?? []
  return current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
}

/** Le panneau de filtres de la découverte, repris de MediaHub : tri, genres, période, langue, plateformes. */
export function FilterPanel({
  search,
  genres,
  providers: initialProviders,
  providerType,
}: {
  search: string
  genres: TmdbGenre[]
  providers: TmdbWatchProvider[]
  providerType: MediaType | 'all'
}) {
  const router = useRouter()
  const current = parseDiscoverQuery(new URLSearchParams(search))
  const [open, setOpen] = useState(false)
  const [filters, setFilters] = useState<DiscoverQuery['filters']>(current.filters)
  const [providers, setProviders] = useState(initialProviders)
  const [loadingProviders, startProviders] = useTransition()
  const count = activeFilterCount(current.filters)
  const region = filters.watchRegion ?? DEFAULT_REGION

  function update(patch: Partial<DiscoverQuery['filters']>) {
    setFilters((previous) => ({ ...previous, ...patch }))
  }

  function apply(next: DiscoverQuery['filters']) {
    setOpen(false)
    router.push(discoverHref({ ...current, filters: next }))
  }

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          setFilters(current.filters)
          setOpen(true)
        }}
      >
        <FilterIcon size={16} aria-hidden />
        Filtres
        {count > 0 && <span className="rounded-full bg-text px-1.5 font-mono text-caption text-on-primary">{count}</span>}
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Filtres"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => apply({})}>
              Réinitialiser
            </Button>
            <Button onClick={() => apply(filters)}>Afficher les résultats</Button>
          </>
        }
      >
        <Section title="Trier par">
          <div className="flex flex-wrap gap-2">
            {SORT_OPTIONS.map((option) => (
              <Chip key={option.value} pressed={(filters.sortBy ?? DEFAULT_SORT) === option.value} onClick={() => update({ sortBy: option.value })}>
                {option.label}
              </Chip>
            ))}
          </div>
        </Section>

        {genres.length > 0 && (
          <Section title="Genres">
            <div className="flex flex-wrap gap-2">
              {genres.map((genre) => (
                <Chip key={genre.id} pressed={filters.genres?.includes(genre.id) ?? false} onClick={() => update({ genres: toggle(filters.genres, genre.id) })}>
                  {genre.name}
                </Chip>
              ))}
            </div>
          </Section>
        )}

        <Section title="Date de sortie">
          <div className="grid grid-cols-2 gap-3">
            {(['from', 'to'] as const).map((field) => (
              <label key={field} className="flex flex-col gap-1.5 text-footnote font-medium text-text-secondary">
                {field === 'from' ? 'Du' : 'Au'}
                <input
                  type="date"
                  value={filters[field] ?? ''}
                  onChange={(event) => update({ [field]: event.target.value || undefined })}
                  className="min-h-11 rounded-card border border-border bg-elevated px-3 text-body text-text outline-none focus:border-accent"
                />
              </label>
            ))}
          </div>
        </Section>

        <Section title="Langue originale">
          <div className="flex flex-wrap gap-2">
            <Chip pressed={!filters.originalLanguage} onClick={() => update({ originalLanguage: undefined })}>
              Toutes
            </Chip>
            {LANGUAGES.map((language) => (
              <Chip key={language.code} pressed={filters.originalLanguage === language.code} onClick={() => update({ originalLanguage: language.code })}>
                {language.name}
              </Chip>
            ))}
          </div>
        </Section>

        <Section title="Plateformes de streaming">
          <label className="mb-3 flex items-center gap-3 text-footnote font-medium text-text-secondary">
            Pays
            <select
              value={region}
              onChange={(event) => {
                const next = event.target.value
                update({ watchRegion: next, watchProviders: undefined })
                startProviders(async () => setProviders(await loadWatchProviders(providerType, next)))
              }}
              className="min-h-11 shell:min-h-10 rounded-card border border-border bg-elevated px-3 text-body text-text outline-none focus:border-accent"
            >
              {REGIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div aria-busy={loadingProviders} className="flex flex-wrap gap-2">
            {providers.map((provider) => {
              const logo = tmdbImageUrl(provider.logo_path, 'w92')
              const pressed = filters.watchProviders?.includes(provider.provider_id) ?? false
              return (
                <Chip
                  key={provider.provider_id}
                  pressed={pressed}
                  onClick={() => update({ watchProviders: toggle(filters.watchProviders, provider.provider_id) })}
                  className="pl-1.5"
                >
                  {logo && <Image src={logo} alt="" width={28} height={28} className="rounded-full" />}
                  {provider.provider_name}
                </Chip>
              )
            })}
            {providers.length === 0 && !loadingProviders && <p className="text-body text-text-muted">Aucune plateforme connue pour ce pays.</p>}
          </div>
        </Section>
      </Dialog>
    </>
  )
}
