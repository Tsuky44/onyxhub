import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { CatalogGrid } from '@/components/media/CatalogGrid'
import { MediaGridSkeleton } from '@/components/media/MediaCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { getViewer, type Viewer } from '@/lib/auth/viewer'
import { cn } from '@/lib/cn'
import { errorMessage, NotConfiguredError } from '@/lib/http'
import { RequestIcon, WarningIcon } from '@/lib/icons'
import { loadCatalog } from '@/lib/requests/catalog'
import { DISCOVER_VIEWS, discoverHref, parseDiscoverQuery, type DiscoverQuery } from '@/lib/requests/discover-query'
import { getTmdb } from '@/lib/services/tmdb/client'
import type { MediaType, TmdbGenre, TmdbWatchProvider } from '@/lib/services/tmdb/types'
import { FilterPanel } from './FilterPanel'
import { RequestsNav } from './RequestsNav'
import { SearchBox } from './SearchBox'

export const metadata: Metadata = { title: 'Demandes' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function toSearch(params: Record<string, string | string[] | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (typeof value === 'string') search.set(key, value)
  return search.toString()
}

function viewType(query: DiscoverQuery): MediaType | 'all' {
  return query.view === 'films' ? 'movie' : query.view === 'series' ? 'tv' : 'all'
}

const EMPTY: Record<DiscoverQuery['view'], { title: string; description: string }> = {
  tout: { title: 'Rien trouvé', description: 'Essaie un autre titre, ou retire des filtres.' },
  films: { title: 'Aucun film', description: 'Essaie un autre titre, ou retire des filtres.' },
  series: { title: 'Aucune série', description: 'Essaie un autre titre, ou retire des filtres.' },
  'plus-tard': { title: 'Ta liste est vide', description: 'Sur une fiche, « Plus tard » garde un titre ici pour y revenir.' },
  'pour-toi': { title: 'Pas encore de recommandations', description: 'Demande quelques titres : les suggestions partent de tes demandes.' },
}

async function Results({ query, search, viewer }: { query: DiscoverQuery; search: string; viewer: Viewer }) {
  const result = await loadCatalog({ kind: 'discover', query }, 1, viewer).then(
    (page) => ({ ok: true as const, page }),
    (error: unknown) => ({ ok: false as const, error }),
  )
  if (result.ok) {
    return <CatalogGrid source={{ kind: 'discover', search }} initial={result.page} emptyTitle={EMPTY[query.view].title} emptyDescription={EMPTY[query.view].description} />
  }
  if (result.error instanceof NotConfiguredError) {
    return (
      <EmptyState
        icon={RequestIcon}
        title="TMDB n'est pas encore branché"
        description={viewer.isAdmin ? 'Ajoute une clé TMDB dans Réglages pour parcourir le catalogue.' : "Un administrateur doit d'abord ajouter une clé TMDB."}
      />
    )
  }
  return <EmptyState icon={WarningIcon} title="Le catalogue ne répond pas" description={errorMessage(result.error)} />
}

/** Filtres, plateformes et genres : facultatifs, la page s'affiche sans eux si TMDB hésite. */
async function filterOptions(type: MediaType | 'all', region: string): Promise<{ genres: TmdbGenre[]; providers: TmdbWatchProvider[] }> {
  try {
    const tmdb = getTmdb()
    const [movieGenres, showGenres, movieProviders, showProviders] = await Promise.all([
      type === 'tv' ? [] : tmdb.genres('movie'),
      type === 'movie' ? [] : tmdb.genres('tv'),
      type === 'tv' ? [] : tmdb.watchProviders('movie', region),
      type === 'movie' ? [] : tmdb.watchProviders('tv', region),
    ])
    const genres = [...new Map([...movieGenres, ...showGenres].map((genre) => [genre.id, genre])).values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    const providers = [...new Map([...movieProviders, ...showProviders].map((provider) => [provider.provider_id, provider])).values()]
      .sort((a, b) => (a.display_priority ?? 999) - (b.display_priority ?? 999))
      .slice(0, 40)
    return { genres, providers }
  } catch {
    return { genres: [], providers: [] }
  }
}

export default async function DiscoverPage({ searchParams }: { searchParams: SearchParams }) {
  const viewer = await getViewer()
  const search = toSearch(await searchParams)
  const query = parseDiscoverQuery(new URLSearchParams(search))
  const browsing = query.view !== 'plus-tard' && query.view !== 'pour-toi'
  const options = browsing ? await filterOptions(viewType(query), query.filters.watchRegion ?? 'FR') : null

  return (
    <>
      <PageHeader
        title="Demandes"
        description={viewer.canRequest ? 'Trouve un film ou une série et demande-le au serveur.' : 'Parcours le catalogue et suis les demandes du serveur.'}
        actions={<RequestsNav current="decouvrir" />}
      />

      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-col gap-3 shell:flex-row shell:items-center">
          <SearchBox search={search} />
          {options && <FilterPanel key={search} search={search} genres={options.genres} providers={options.providers} providerType={viewType(query)} />}
        </div>
        <nav aria-label="Vues" className="scrollbar-none -mx-5 flex gap-1 overflow-x-auto px-5 shell:mx-0 shell:px-0">
          {DISCOVER_VIEWS.map((view) => {
            const active = query.view === view.id
            const href = view.id === 'plus-tard' || view.id === 'pour-toi' ? discoverHref({ view: view.id, query: '', filters: {} }) : discoverHref({ ...query, view: view.id })
            return (
              <Link
                key={view.id}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-11 shell:min-h-10 items-center rounded-full px-3.5 text-subhead whitespace-nowrap transition-colors duration-(--motion-micro) ease-onyx',
                  active ? 'bg-elevated font-semibold text-text' : 'font-medium text-text-secondary hover:text-text',
                )}
              >
                {view.label}
              </Link>
            )
          })}
        </nav>
        {query.query && browsing && (
          <p className="text-body text-text-secondary" aria-live="polite">
            Résultats pour <span className="font-semibold text-text">« {query.query} »</span>
          </p>
        )}
      </div>

      <Suspense key={search} fallback={<MediaGridSkeleton />}>
        <Results query={query} search={search} viewer={viewer} />
      </Suspense>
    </>
  )
}
