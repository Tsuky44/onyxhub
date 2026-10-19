'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Dialog } from '@/components/ui/Dialog'
import { cn } from '@/lib/cn'
import { DownloadIcon, SearchIcon, WarningIcon } from '@/lib/icons'
import { formatBytes } from '@/lib/requests/format'
import type { ArrRelease } from '@/lib/services/arr/types'
import type { MediaType } from '@/lib/services/tmdb/types'
import { grabReleaseAction, searchReleasesAction } from './actions'

type Sort = 'seeders' | 'size' | 'age'

function age(release: ArrRelease): string {
  const hours = release.ageHours ?? (release.age !== undefined ? release.age * 24 : null)
  if (hours === null) return ''
  if (hours < 24) return `${Math.max(1, Math.round(hours))} h`
  const days = Math.round(hours / 24)
  return days < 60 ? `${days} j` : `${Math.round(days / 30)} mois`
}

/**
 * La recherche interactive de MediaHub : Radarr ou Sonarr interroge les
 * indexeurs, l'admin choisit la release. Les releases refusées par les
 * profils restent visibles, avec la raison, mais à la fin de la liste.
 */
export function ReleaseSearch({
  open,
  onClose,
  mediaType,
  tmdbId,
  tvdbId,
  scope,
  label,
}: {
  open: boolean
  onClose: () => void
  mediaType: MediaType
  tmdbId: number
  tvdbId: number | null
  scope: { seasonNumber?: number; episodeId?: number }
  label: string
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Recherche interactive" description={label} size="xl">
      <Results key={JSON.stringify(scope)} mediaType={mediaType} tmdbId={tmdbId} tvdbId={tvdbId} scope={scope} />
    </Dialog>
  )
}

function Results({
  mediaType,
  tmdbId,
  tvdbId,
  scope,
}: {
  mediaType: MediaType
  tmdbId: number
  tvdbId: number | null
  scope: { seasonNumber?: number; episodeId?: number }
}) {
  const [releases, setReleases] = useState<ArrRelease[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searching, startSearch] = useTransition()
  const [grabbing, setGrabbing] = useState<string | null>(null)
  const [grabbed, setGrabbed] = useState<Record<string, { ok: boolean; message: string }>>({})
  const [filter, setFilter] = useState('')
  const [sort, setSort] = useState<Sort>('seeders')
  const [hideRejected, setHideRejected] = useState(false)
  const scopeKey = JSON.stringify(scope)

  // Monté à l'ouverture de la modale (et remonté pour une autre saison) : l'état part toujours de zéro.
  useEffect(() => {
    startSearch(async () => {
      const result = await searchReleasesAction(mediaType, tmdbId, JSON.parse(scopeKey) as typeof scope, tvdbId)
      if (result.ok) setReleases(result.value)
      else setError(result.message)
    })
  }, [mediaType, tmdbId, tvdbId, scopeKey])

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    const list = (releases ?? []).filter((release) => (!hideRejected || !release.rejected) && (!needle || release.title.toLowerCase().includes(needle)))
    const value = (release: ArrRelease) => (sort === 'size' ? release.size : sort === 'age' ? -(release.ageHours ?? (release.age ?? 0) * 24) : (release.seeders ?? 0))
    return list.sort((a, b) => Number(Boolean(a.rejected)) - Number(Boolean(b.rejected)) || value(b) - value(a))
  }, [releases, filter, sort, hideRejected])

  async function grab(release: ArrRelease) {
    setGrabbing(release.guid)
    const result = await grabReleaseAction(mediaType, release.guid, release.indexerId)
    setGrabbed((previous) => ({ ...previous, [release.guid]: result.ok ? { ok: true, message: result.value } : { ok: false, message: result.message } }))
    setGrabbing(null)
  }

  return (
    <>
      {searching && (
        <div role="status" className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="size-6 animate-spin rounded-full border-2 border-text-muted border-r-transparent" aria-hidden />
          <p className="text-body text-text-secondary">{mediaType === 'movie' ? 'Radarr' : 'Sonarr'} interroge tes indexeurs, ça peut prendre une minute…</p>
        </div>
      )}

      {error && !searching && (
        <div role="alert" className="flex flex-col items-center gap-3 py-12 text-center">
          <WarningIcon size={28} className="text-error" aria-hidden />
          <p className="max-w-md text-body text-text-secondary">{error}</p>
        </div>
      )}

      {releases && !searching && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 shell:flex-row shell:items-center">
            <div className="relative flex-1">
              <SearchIcon size={16} aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-muted" />
              <input
                type="search"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Filtrer (1080p, MULTI, x265…)"
                aria-label="Filtrer les releases"
                className="min-h-11 w-full rounded-card border border-border bg-elevated pr-3 pl-9 text-body text-text placeholder:text-text-muted outline-none focus:border-accent"
              />
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Trier">
              {(
                [
                  ['seeders', 'Sources'],
                  ['size', 'Taille'],
                  ['age', 'Récentes'],
                ] as const
              ).map(([value, text]) => (
                <Chip key={value} pressed={sort === value} onClick={() => setSort(value)}>
                  {text}
                </Chip>
              ))}
              <Chip pressed={hideRejected} onClick={() => setHideRejected(!hideRejected)}>
                Masquer les refusées
              </Chip>
            </div>
          </div>

          <p className="text-footnote text-text-muted">
            {visible.length} release{visible.length > 1 ? 's' : ''} sur {releases.length}
          </p>

          {visible.length === 0 ? (
            <p className="py-10 text-center text-body text-text-secondary">Aucune release ne correspond.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-glass-border">
              {visible.map((release) => {
                const done = grabbed[release.guid]
                return (
                  <li key={release.guid} className={cn('flex flex-col gap-2 py-3 shell:flex-row shell:items-center shell:gap-4', release.rejected && 'opacity-70')}>
                    <div className="min-w-0 flex-1">
                      <p className="text-subhead font-medium break-words text-text">{release.title}</p>
                      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-footnote text-text-muted">
                        {release.quality?.quality?.name && <span className="text-text-secondary">{release.quality.quality.name}</span>}
                        <span>{formatBytes(release.size)}</span>
                        {release.seeders !== undefined && (
                          <span>
                            {release.seeders} ↑ · {release.leechers ?? 0} ↓
                          </span>
                        )}
                        {release.indexer && <span>{release.indexer}</span>}
                        {age(release) && <span>{age(release)}</span>}
                        {release.languages?.length ? <span>{release.languages.map((language) => language.name).join(', ')}</span> : null}
                      </p>
                      {release.rejected && release.rejections?.length ? (
                        <p className="mt-1 text-footnote text-warning">Refusée : {release.rejections.join(' · ')}</p>
                      ) : null}
                      {done && (
                        <p role="status" className={cn('mt-1 text-footnote', done.ok ? 'text-success' : 'text-error')}>
                          {done.message}
                        </p>
                      )}
                    </div>
                    <Button
                      variant={release.rejected ? 'ghost' : 'secondary'}
                      pending={grabbing === release.guid}
                      disabled={grabbing !== null || done?.ok}
                      onClick={() => grab(release)}
                      className="shrink-0"
                    >
                      <DownloadIcon size={16} aria-hidden />
                      {done?.ok ? 'Envoyée' : 'Télécharger'}
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </>
  )
}
