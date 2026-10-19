'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { cn } from '@/lib/cn'
import type { ReleaseWire } from '@/lib/downloads/prowlarr-search'
import { CloseIcon, DownloadIcon, ExternalIcon, SearchIcon, SortAscendingIcon, SortDescendingIcon } from '@/lib/icons'
import { formatBytes, formatRelative } from '@/lib/requests/format'
import { fieldClass } from '../_torrents/TorrentDialogs'
import { searchReleasesAction, sendReleasesAction } from './actions'

type SortKey = 'seeders' | 'publishDate' | 'size'
const SORTS: { id: SortKey; label: string }[] = [
  { id: 'seeders', label: 'Sources' },
  { id: 'publishDate', label: 'Âge' },
  { id: 'size', label: 'Taille' },
]

function sortValue(release: ReleaseWire, key: SortKey): number {
  if (key === 'publishDate') return new Date(release.publishDate).getTime() || 0
  if (key === 'size') return release.size
  return release.seeders ?? -1
}

function ResultRow({
  release,
  selected,
  onToggle,
  onSend,
  pending,
}: {
  release: ReleaseWire
  selected: boolean
  onToggle: () => void
  onSend: () => void
  pending: boolean
}) {
  const torrent = release.protocol === 'torrent'
  return (
    <li className={cn('lazy-row flex gap-3 px-3 py-3 shell:px-4', selected && 'bg-glass-fill')}>
      <input type="checkbox" checked={selected} disabled={!torrent} onChange={onToggle} aria-label={`Sélectionner ${release.title}`} className="mt-1 size-5 shrink-0 accent-accent" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="text-subhead font-semibold break-all text-text">{release.title}</p>
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-footnote text-text-secondary">
          <span className="font-medium text-text">{release.indexer}</span>
          <span className="font-mono">{formatBytes(release.size)}</span>
          {release.seeders !== null && (
            <span className={cn('font-mono', release.seeders === 0 ? 'text-error' : release.seeders < 5 ? 'text-warning' : 'text-success')}>
              {release.seeders} S · {release.leechers ?? 0} L
            </span>
          )}
          <span>{formatRelative(new Date(release.publishDate))}</span>
          {release.categories[0] && <span className="text-text-muted">{release.categories[0]}</span>}
          {!torrent && <span className="text-text-muted">Usenet</span>}
        </p>
      </div>
      <div className="flex shrink-0 items-start gap-1">
        {release.infoUrl && (
          <a
            href={release.infoUrl}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={`Page de ${release.title} chez ${release.indexer}`}
            className="flex size-10 items-center justify-center rounded-full text-text-muted hover:bg-glass-fill hover:text-text"
          >
            <ExternalIcon size={18} aria-hidden />
          </a>
        )}
        <Button variant="secondary" disabled={!torrent || pending} onClick={onSend} aria-label={`Envoyer ${release.title} vers qBittorrent`}>
          <DownloadIcon size={16} aria-hidden />
          <span className="hidden sm:inline">Envoyer</span>
        </Button>
      </div>
    </li>
  )
}

/**
 * Recherche multi-indexeurs dans Prowlarr : catégories, indexeurs, tri,
 * pages de 100, envoi d'une ou plusieurs releases vers qBittorrent.
 * Une recherche vide liste les dernières releases des indexeurs (« Récents » de MediaHub).
 */
export function ReleaseSearch({ indexers, categories, initialQuery }: { indexers: { id: number; name: string }[]; categories: readonly { id: number; label: string }[]; initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery)
  const [chosenCategories, setChosenCategories] = useState<number[]>([])
  const [chosenIndexers, setChosenIndexers] = useState<number[]>([])
  const [releases, setReleases] = useState<ReleaseWire[] | null>(null)
  const [more, setMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<{ key: SortKey; order: 'asc' | 'desc' }>({ key: 'seeders', order: 'desc' })
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null)
  const [searching, startSearch] = useTransition()
  const [sending, startSend] = useTransition()
  const [searchedOnce, setSearchedOnce] = useState(false)

  const sorted = useMemo(() => {
    if (!releases) return []
    const direction = sort.order === 'asc' ? 1 : -1
    return [...releases].sort((a, b) => (sortValue(a, sort.key) - sortValue(b, sort.key)) * direction)
  }, [releases, sort])

  const search = (offset: number) =>
    startSearch(async () => {
      const result = await searchReleasesAction({ query, categories: chosenCategories, indexerIds: chosenIndexers, offset })
      setSearchedOnce(true)
      if (!result.ok) {
        setError(result.message)
        return
      }
      setError(null)
      setMore(result.more)
      // Une page suivante s'ajoute ; une nouvelle recherche remplace (et vide la sélection).
      setReleases((current) => (offset > 0 && current ? [...current, ...result.releases.filter((release) => !current.some((known) => known.guid === release.guid))] : result.releases))
      if (offset === 0) setSelected(new Set())
    })

  const send = (guids: string[]) =>
    startSend(async () => {
      const result = await sendReleasesAction(guids)
      setFeedback(
        result.failures.length === 0
          ? { ok: true, message: result.sent > 1 ? `${result.sent} releases envoyées.` : 'Release envoyée.' }
          : { ok: false, message: `${result.sent} envoyée${result.sent > 1 ? 's' : ''}, ${guids.length - result.sent} en échec : ${result.failures.join(' ; ')}` },
      )
      if (result.failures.length === 0) setSelected(new Set())
    })

  const toggleIn = (list: number[], id: number) => (list.includes(id) ? list.filter((value) => value !== id) : [...list, id])

  // La première recherche part seule quand on arrive avec ?q= (depuis un torrent ou une fiche).
  const autoStarted = useRef(false)
  useEffect(() => {
    if (autoStarted.current || !initialQuery) return
    autoStarted.current = true
    search(0)
    // Une seule fois, à l'arrivée : la recherche lit l'état initial, rien à suivre ensuite.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col gap-5">
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault()
          search(0)
        }}
        className="flex flex-col gap-4 rounded-panel border border-glass-border bg-surface p-4"
      >
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <SearchIcon size={16} aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-text-muted" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Titre, saison (S02), année…"
              aria-label="Rechercher une release"
              enterKeyHint="search"
              className={cn(fieldClass, 'pl-10')}
            />
          </div>
          <Button type="submit" pending={searching}>
            {query.trim() ? 'Chercher' : 'Récents'}
          </Button>
        </div>
        <div role="group" aria-label="Catégories" className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <Chip key={category.id} pressed={chosenCategories.includes(category.id)} onClick={() => setChosenCategories(toggleIn(chosenCategories, category.id))}>
              {category.label}
            </Chip>
          ))}
        </div>
        {indexers.length > 1 && (
          <details className="group">
            <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 text-footnote font-medium text-text-secondary hover:text-text">
              Indexeurs
              <span className="font-mono text-text-muted">{chosenIndexers.length > 0 ? `${chosenIndexers.length}/${indexers.length}` : 'tous'}</span>
            </summary>
            <div role="group" aria-label="Indexeurs" className="mt-2 flex flex-wrap gap-2">
              {indexers.map((indexer) => (
                <Chip key={indexer.id} pressed={chosenIndexers.includes(indexer.id)} onClick={() => setChosenIndexers(toggleIn(chosenIndexers, indexer.id))}>
                  {indexer.name}
                </Chip>
              ))}
            </div>
          </details>
        )}
      </form>

      {error && (
        <p role="alert" className="text-subhead text-error">
          {error}
        </p>
      )}

      {releases && (
        <section aria-label="Résultats" aria-busy={searching} className="rounded-panel border border-glass-border bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-glass-border p-3 shell:px-4">
            <p className="text-footnote text-text-secondary" aria-live="polite">
              {releases.length} résultat{releases.length > 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-1">
              <label htmlFor="tri-releases" className="sr-only">
                Trier par
              </label>
              <select id="tri-releases" value={sort.key} onChange={(event) => setSort({ ...sort, key: event.target.value as SortKey })} className={cn(fieldClass, 'w-auto')}>
                {SORTS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setSort({ ...sort, order: sort.order === 'asc' ? 'desc' : 'asc' })}
                aria-label={sort.order === 'asc' ? 'Ordre croissant (inverser)' : 'Ordre décroissant (inverser)'}
                className="flex size-11 items-center justify-center rounded-card border border-glass-border bg-glass-fill text-text-secondary hover:text-text"
              >
                {sort.order === 'asc' ? <SortAscendingIcon size={18} aria-hidden /> : <SortDescendingIcon size={18} aria-hidden />}
              </button>
            </div>
          </div>
          {sorted.length === 0 ? (
            <p className="px-4 py-10 text-center text-body text-text-secondary">Aucune release trouvée.</p>
          ) : (
            <ul className="divide-y divide-glass-border">
              {sorted.map((release) => (
                <ResultRow
                  key={release.guid}
                  release={release}
                  selected={selected.has(release.guid)}
                  pending={sending}
                  onToggle={() =>
                    setSelected((current) => {
                      const next = new Set(current)
                      if (next.has(release.guid)) next.delete(release.guid)
                      else next.add(release.guid)
                      return next
                    })
                  }
                  onSend={() => send([release.guid])}
                />
              ))}
            </ul>
          )}
          {more && (
            <div className="border-t border-glass-border p-3 text-center">
              <Button variant="ghost" pending={searching} onClick={() => search(releases.length)}>
                Plus de résultats
              </Button>
            </div>
          )}
        </section>
      )}

      {!releases && !searching && !searchedOnce && (
        <p className="text-body text-text-secondary">Cherche une release dans tous tes indexeurs, ou lance « Récents » sans texte pour voir les dernières parues.</p>
      )}

      {feedback && (
        <p role="status" className={cn('text-footnote', feedback.ok ? 'text-success' : 'text-error')}>
          {feedback.message}
        </p>
      )}

      {selected.size > 0 && (
        <div className="glass-strong sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 flex items-center gap-2 rounded-panel border border-glass-border p-2 shadow-float shell:bottom-4">
          <span className="flex-1 px-2 text-subhead font-semibold text-text">
            {selected.size} sélectionnée{selected.size > 1 ? 's' : ''}
          </span>
          <Button pending={sending} onClick={() => send([...selected])}>
            <DownloadIcon size={16} aria-hidden />
            Envoyer
          </Button>
          <Button variant="ghost" onClick={() => setSelected(new Set())} aria-label="Annuler la sélection">
            <CloseIcon size={18} aria-hidden />
          </Button>
        </div>
      )}
    </div>
  )
}
