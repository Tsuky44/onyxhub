import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { MediaCard } from '@/components/media/MediaCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { getViewer } from '@/lib/auth/viewer'
import { errorMessage, ServiceError } from '@/lib/http'
import { PersonIcon, WarningIcon } from '@/lib/icons'
import { withStatus } from '@/lib/requests/catalog'
import { getTmdb } from '@/lib/services/tmdb/client'
import type { TmdbPerson, TmdbSummary } from '@/lib/services/tmdb/types'
import { tmdbImageUrl } from '@/lib/tmdb-image'

type Params = Promise<{ id: string }>

const DEPARTMENTS: Record<string, string> = {
  Acting: 'Interprétation',
  Directing: 'Réalisation',
  Writing: 'Scénario',
  Production: 'Production',
  Sound: 'Musique',
  Camera: 'Image',
  Editing: 'Montage',
  Art: 'Direction artistique',
  'Costume & Make-Up': 'Costumes et maquillage',
  Crew: 'Équipe technique',
  'Visual Effects': 'Effets visuels',
  Lighting: 'Lumière',
}

const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

const person = cache((id: number) => getTmdb().person(id))

function parseId(raw: string): number {
  const id = Number(raw)
  if (!Number.isInteger(id) || id <= 0) notFound()
  return id
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  try {
    return { title: (await person(parseId((await params).id))).name }
  } catch {
    return { title: 'Personnalité' }
  }
}

/** La filmographie : une seule entrée par titre (un acteur peut y tenir deux rôles), les plus connus d'abord. */
function filmography(data: TmdbPerson): TmdbSummary[] {
  const credits = [...(data.combined_credits?.cast ?? []), ...(data.combined_credits?.crew ?? [])]
  const unique = new Map<string, TmdbSummary>()
  for (const credit of credits) {
    if (credit.media_type !== 'movie' && credit.media_type !== 'tv') continue
    const key = `${credit.media_type}:${credit.id}`
    if (!unique.has(key)) unique.set(key, credit)
  }
  return [...unique.values()].sort((a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0)).slice(0, 60)
}

function formatDate(date: string | null | undefined): string | null {
  if (!date) return null
  const parsed = new Date(`${date}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : DATE.format(parsed)
}

export default async function PersonPage({ params }: { params: Params }) {
  await getViewer()
  const id = parseId((await params).id)
  let data: TmdbPerson
  try {
    data = await person(id)
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) notFound()
    return <EmptyState icon={WarningIcon} title="Cette fiche ne répond pas" description={errorMessage(error)} />
  }

  const items = await withStatus(filmography(data))
  const photo = tmdbImageUrl(data.profile_path, 'h632')
  const facts = [
    ['Connu pour', data.known_for_department ? (DEPARTMENTS[data.known_for_department] ?? data.known_for_department) : null],
    ['Naissance', [formatDate(data.birthday), data.place_of_birth].filter(Boolean).join(', ') || null],
    ['Décès', formatDate(data.deathday)],
  ].filter((fact): fact is [string, string] => Boolean(fact[1]))

  return (
    <article className="flex flex-col gap-10">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start shell:gap-10">
        <div className="relative aspect-[2/3] w-40 shrink-0 overflow-hidden rounded-panel border border-glass-border bg-elevated shell:w-56">
          {photo ? (
            <Image src={photo} alt="" fill priority sizes="(min-width: 900px) 224px, 160px" className="object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-text-muted">
              <PersonIcon size={40} aria-hidden />
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <h1 className="text-display font-bold tracking-[-0.02em] text-balance text-text shell:text-large-title">{data.name}</h1>
          {facts.length > 0 && (
            <dl className="flex flex-wrap gap-x-8 gap-y-3">
              {facts.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-footnote text-text-muted">{label}</dt>
                  <dd className="text-subhead font-medium text-text">{value}</dd>
                </div>
              ))}
            </dl>
          )}
          {data.biography ? (
            <p className="max-w-3xl text-callout leading-relaxed whitespace-pre-line text-pretty text-text-secondary">{data.biography}</p>
          ) : (
            <p className="text-callout text-text-muted">Pas encore de biographie en français.</p>
          )}
        </div>
      </header>

      <section aria-labelledby="filmographie">
        <h2 id="filmographie" className="mb-4 text-title3 font-bold text-text">
          Filmographie <span className="font-mono text-callout font-normal text-text-muted">{items.length}</span>
        </h2>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 shell:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
          {items.map((item) => (
            <li key={`${item.mediaType}:${item.tmdbId}`}>
              <MediaCard item={item} />
            </li>
          ))}
        </ul>
      </section>
    </article>
  )
}
