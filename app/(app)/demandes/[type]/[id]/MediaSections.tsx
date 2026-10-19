import Image from 'next/image'
import Link from 'next/link'
import { Rail } from '@/components/media/MediaRail'
import { PersonIcon } from '@/lib/icons'
import type { CrewGroup } from '@/lib/requests/media-page'
import type { MediaType, TmdbCastMember, TmdbDetails, TmdbWatchProvider, TmdbWatchProviders } from '@/lib/services/tmdb/types'
import { tmdbImageUrl } from '@/lib/tmdb-image'

/** Les sections statiques de la fiche, rendues côté serveur. */

const LANGUAGES = new Intl.DisplayNames(['fr'], { type: 'language' })
const MONEY = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 })
const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

const STATUS_FR: Record<string, string> = {
  Released: 'Sorti',
  'Post Production': 'Post-production',
  'In Production': 'En production',
  Planned: 'Prévu',
  Rumored: 'Annoncé',
  Canceled: 'Annulé',
  'Returning Series': 'En cours de diffusion',
  Ended: 'Terminée',
  'In production': 'En production',
  Pilot: 'Pilote',
}

function longDate(date: string | null | undefined): string | null {
  if (!date) return null
  const parsed = new Date(`${date}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : DATE.format(parsed)
}

function language(code: string | undefined): string | null {
  if (!code) return null
  try {
    const name = LANGUAGES.of(code)
    return name ? name.charAt(0).toUpperCase() + name.slice(1) : code
  } catch {
    return code
  }
}

export function Overview({ details, crew }: { details: TmdbDetails; crew: CrewGroup[] }) {
  const keywords = details.keywords?.keywords ?? details.keywords?.results ?? []
  return (
    <section aria-labelledby="synopsis" className="flex min-w-0 flex-col gap-6">
      <div>
        <h2 id="synopsis" className="mb-3 text-title3 font-bold text-text">
          Synopsis
        </h2>
        <p className="max-w-3xl text-callout leading-relaxed text-pretty text-text-secondary">{details.overview || 'Pas encore de résumé en français.'}</p>
      </div>
      {crew.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          {crew.map((group) => (
            <div key={group.label} className="min-w-0">
              <dt className="text-footnote text-text-muted">{group.label}</dt>
              <dd className="mt-0.5 text-subhead font-medium text-text">
                {group.people.map((person, index) => (
                  <span key={person.id}>
                    {index > 0 && ', '}
                    <Link href={`/demandes/personne/${person.id}`} className="hover:text-accent-muted">
                      {person.name}
                    </Link>
                  </span>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {keywords.length > 0 && (
        <ul aria-label="Mots-clés" className="flex flex-wrap gap-2">
          {keywords.slice(0, 16).map((keyword) => (
            <li key={keyword.id} className="rounded-full border border-glass-border px-3 py-1 text-footnote text-text-secondary">
              {keyword.name}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function ProviderList({ label, providers }: { label: string; providers: TmdbWatchProvider[] | undefined }) {
  if (!providers?.length) return null
  return (
    <div>
      <p className="mb-2 text-footnote text-text-muted">{label}</p>
      <ul className="flex flex-wrap gap-2">
        {providers.map((provider) => {
          const logo = tmdbImageUrl(provider.logo_path, 'w92')
          return (
            <li key={provider.provider_id} title={provider.provider_name}>
              {logo ? (
                <Image src={logo} alt={provider.provider_name} width={40} height={40} className="rounded-card" />
              ) : (
                <span className="text-footnote text-text-secondary">{provider.provider_name}</span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function Facts({ details, mediaType, providers }: { details: TmdbDetails; mediaType: MediaType; providers: TmdbWatchProviders | null }) {
  const rows: [string, string | null | undefined][] = [
    ['Statut', details.status ? (STATUS_FR[details.status] ?? details.status) : null],
    ['Titre original', (details.original_title ?? details.original_name) !== (details.title ?? details.name) ? (details.original_title ?? details.original_name) : null],
    [mediaType === 'movie' ? 'Sortie' : 'Première diffusion', longDate(details.release_date ?? details.first_air_date)],
    ...(mediaType === 'tv' ? ([['Dernière diffusion', longDate(details.last_air_date)]] as [string, string | null][]) : []),
    ['Langue originale', language(details.original_language)],
    ['Budget', details.budget ? MONEY.format(details.budget) : null],
    ['Recettes', details.revenue ? MONEY.format(details.revenue) : null],
    [mediaType === 'tv' ? 'Diffuseur' : 'Studio', (mediaType === 'tv' ? details.networks : details.production_companies)?.slice(0, 3).map((company) => company.name).join(', ')],
  ]
  return (
    <aside className="flex flex-col gap-6 rounded-panel border border-glass-border bg-surface p-5">
      <dl className="flex flex-col gap-3">
        {rows
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4">
              <dt className="text-subhead text-text-muted">{label}</dt>
              <dd className="text-right text-subhead font-medium text-text">{value}</dd>
            </div>
          ))}
      </dl>
      {providers && (providers.flatrate?.length || providers.rent?.length || providers.buy?.length) ? (
        <div className="flex flex-col gap-4 border-t border-glass-border pt-5">
          <ProviderList label="En streaming en France" providers={providers.flatrate} />
          <ProviderList label="Location" providers={providers.rent} />
          <ProviderList label="Achat" providers={providers.buy} />
          <p className="text-caption text-text-muted">Données JustWatch, via TMDB.</p>
        </div>
      ) : null}
    </aside>
  )
}

export function CastRail({ cast }: { cast: TmdbCastMember[] }) {
  if (cast.length === 0) return null
  return (
    <Rail title="Casting">
      {cast.slice(0, 25).map((member) => {
        const photo = tmdbImageUrl(member.profile_path, 'w185')
        return (
          <Link key={member.id} href={`/demandes/personne/${member.id}`} className="group flex w-28 shrink-0 snap-start flex-col gap-2 shell:w-32">
            <div className="relative aspect-[2/3] overflow-hidden rounded-card border border-glass-border bg-elevated">
              {photo ? (
                <Image src={photo} alt="" fill sizes="128px" className="object-cover transition-transform duration-(--motion-emphasis) ease-onyx group-hover:scale-105" />
              ) : (
                <div className="flex size-full items-center justify-center text-text-muted">
                  <PersonIcon size={28} aria-hidden />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-subhead font-semibold text-text">{member.name}</p>
              {member.character && <p className="truncate text-footnote text-text-muted">{member.character}</p>}
            </div>
          </Link>
        )
      })}
    </Rail>
  )
}

export function CollectionCard({ collection }: { collection: NonNullable<TmdbDetails['belongs_to_collection']> }) {
  const backdrop = tmdbImageUrl(collection.backdrop_path, 'w1280')
  return (
    <Link href={`/demandes/collection/${collection.id}`} className="group relative block overflow-hidden rounded-panel border border-glass-border bg-surface">
      {backdrop && <Image src={backdrop} alt="" fill sizes="(min-width: 900px) 60vw, 100vw" className="object-cover opacity-40 transition-transform duration-(--motion-emphasis) ease-onyx group-hover:scale-105" />}
      <div className="relative flex min-h-32 flex-col justify-end gap-1 bg-gradient-to-t from-bg via-bg/70 to-transparent p-5">
        <p className="text-footnote font-semibold tracking-wide text-text-muted uppercase">Fait partie d&apos;une saga</p>
        <p className="text-title3 font-bold text-text">{collection.name}</p>
        <p className="text-subhead text-text-secondary">Voir tous les films de la collection</p>
      </div>
    </Link>
  )
}
