'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ReleaseRow, releaseSubtitle } from '@/components/calendar/ReleaseRow'
import { cn } from '@/lib/cn'
import { byDay, dayNumber, dayTitle } from '@/lib/calendar/query'
import type { UpcomingRelease } from '@/lib/calendar/upcoming'
import { mediaHref } from '@/lib/requests/format'

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
/** Au-delà, la case renvoie au détail du jour sous la grille. */
const CHIPS_PER_DAY = 3

function tone(release: UpcomingRelease): string {
  if (release.hasFile) return 'bg-success'
  if (release.mine) return 'bg-accent'
  return 'bg-text-muted'
}

function countLabel(count: number): string {
  return count === 0 ? 'aucune sortie' : `${count} sortie${count > 1 ? 's' : ''}`
}

/**
 * Le mois en grille. Sur téléphone, une case montre des points et se touche
 * pour afficher le détail du jour sous la grille ; sur grand écran, elle
 * montre les titres, qui mènent à la fiche. MediaHub ouvrait une infobulle au
 * survol, inutilisable au doigt (double tap) et illisible au clavier.
 */
export function MonthView({ days, month, today, releases }: { days: string[]; month: string; today: string; releases: UpcomingRelease[] }) {
  const grouped = useMemo(() => byDay(releases), [releases])
  const [selected, setSelected] = useState<string | null>(() =>
    today.startsWith(month) ? today : (days.find((day) => day.startsWith(month) && grouped.has(day)) ?? null),
  )
  const selectedReleases = selected ? (grouped.get(selected) ?? []) : []

  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-hidden rounded-panel border border-glass-border bg-surface">
        <div aria-hidden className="grid grid-cols-7 border-b border-glass-border">
          {WEEKDAYS.map((weekday) => (
            <div key={weekday} className="py-2 text-center text-caption font-semibold text-text-muted">
              {weekday}
            </div>
          ))}
        </div>
        <ol className="grid grid-cols-7">
          {days.map((day, index) => {
            const items = grouped.get(day) ?? []
            const outside = !day.startsWith(month)
            const isSelected = selected === day
            return (
              <li
                key={day}
                className={cn(
                  'relative min-h-16 min-w-0 border-glass-border p-1 md:min-h-28 md:p-2',
                  index % 7 !== 6 && 'border-r',
                  index < days.length - 7 && 'border-b',
                  outside && 'bg-bg/40',
                  isSelected && 'bg-glass-fill',
                )}
              >
                <button
                  type="button"
                  onClick={() => setSelected(day)}
                  aria-pressed={isSelected}
                  aria-label={`${dayTitle(day)}, ${countLabel(items.length)}`}
                  className="absolute inset-0 transition-colors duration-(--motion-micro) ease-onyx hover:bg-glass-fill"
                />
                <span
                  aria-hidden
                  className={cn(
                    'pointer-events-none relative flex size-7 items-center justify-center rounded-full text-footnote',
                    day === today ? 'bg-accent font-semibold text-on-accent' : outside ? 'text-text-muted' : 'font-medium text-text-secondary',
                  )}
                >
                  {dayNumber(day)}
                </span>
                {items.length > 0 && (
                  <span aria-hidden className="pointer-events-none relative mt-1 flex flex-wrap gap-1 px-1 md:hidden">
                    {items.slice(0, 4).map((release) => (
                      <span key={release.id} className={cn('size-1.5 rounded-full', tone(release))} />
                    ))}
                  </span>
                )}
                {items.length > 0 && (
                  <ul className="pointer-events-none relative mt-1 hidden flex-col gap-1 md:flex">
                    {items.slice(0, CHIPS_PER_DAY).map((release) => {
                      const className = cn(
                        'flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-caption',
                        release.mine ? 'bg-accent/15 text-text' : 'bg-glass-fill text-text-secondary',
                      )
                      const content = (
                        <>
                          <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', tone(release))} />
                          <span className="truncate">{release.title}</span>
                        </>
                      )
                      return (
                        <li key={release.id} className="min-w-0">
                          {release.tmdbId ? (
                            <Link
                              href={mediaHref(release.mediaType, release.tmdbId)}
                              title={`${release.title} · ${releaseSubtitle(release)}`}
                              className={cn(
                                className,
                                'pointer-events-auto transition-colors duration-(--motion-micro) ease-onyx',
                                release.mine ? 'hover:bg-accent/25' : 'hover:bg-hover hover:text-text',
                              )}
                            >
                              {content}
                            </Link>
                          ) : (
                            <span className={className}>{content}</span>
                          )}
                        </li>
                      )
                    })}
                    {items.length > CHIPS_PER_DAY && (
                      <li aria-hidden className="px-1.5 text-caption text-text-muted">
                        +{items.length - CHIPS_PER_DAY} autre{items.length - CHIPS_PER_DAY > 1 ? 's' : ''}
                      </li>
                    )}
                  </ul>
                )}
              </li>
            )
          })}
        </ol>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2 text-footnote text-text-secondary" aria-hidden>
        <span className="inline-flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-accent" /> Ta demande
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-success" /> Disponible
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-text-muted" /> Autre sortie
        </span>
      </div>

      {selected && (
        <section aria-live="polite" aria-labelledby="jour-choisi" className="rounded-panel border border-glass-border bg-surface p-5">
          <h3 id="jour-choisi" className="mb-4 text-headline font-semibold text-text">
            {dayTitle(selected)}
          </h3>
          {selectedReleases.length === 0 ? (
            <p className="text-body text-text-secondary">Aucune sortie ce jour-là.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {selectedReleases.map((release) => (
                <ReleaseRow key={release.id} release={release} size="md" />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
