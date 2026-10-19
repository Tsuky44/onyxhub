import Link from 'next/link'
import type { ReactNode } from 'react'
import { Poster } from '@/components/media/Poster'
import { Badge, RequestStatusBadge } from '@/components/media/StatusBadge'
import { Panel, ProgressBar } from '@/components/ui/Panel'
import type { LinkedMedia } from '@/lib/downloads/torrent-detail'
import { formatEta, formatRatio, formatSpeed, splitTags, trackerName, type TorrentWire } from '@/lib/downloads/torrents'
import { ExternalIcon } from '@/lib/icons'
import { formatBytes, formatSeasons, mediaHref } from '@/lib/requests/format'
import type { TorrentFile, TorrentPeer, TorrentProperties, TorrentTracker } from '@/lib/services/qbittorrent/types'

const DATE_TIME = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const at = (seconds: number | undefined) => (seconds && seconds > 0 ? DATE_TIME.format(new Date(seconds * 1000)) : '—')

function Facts({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-footnote text-text-muted">{label}</dt>
          <dd className="mt-0.5 text-subhead break-words text-text">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** « 3 j 4 h » à partir de secondes (temps actif, temps de partage). */
const duration = (seconds: number | undefined) => (seconds && seconds > 0 ? formatEta(seconds) : '—')
const limit = (value: number, format: (value: number) => string) => (value === -2 ? 'Réglage global' : value < 0 ? 'Aucune' : format(value))

export function InfoSection({ torrent, properties }: { torrent: TorrentWire; properties: TorrentProperties | null }) {
  const comment = properties?.comment?.trim() ?? ''
  const commentUrl = /^https?:\/\/\S+$/i.test(comment) ? comment : null
  return (
    <Panel title="Informations">
      <Facts
        items={[
          ['Taille', formatBytes(torrent.size)],
          ['Reçu / envoyé', `${formatBytes(torrent.downloaded)} / ${formatBytes(torrent.uploaded)}`],
          ['Ratio', formatRatio(torrent.ratio)],
          ['Débits', `↓ ${formatSpeed(torrent.dlspeed)} · ↑ ${formatSpeed(torrent.upspeed)}`],
          ['Débits moyens', properties ? `↓ ${formatSpeed(properties.dl_speed_avg)} · ↑ ${formatSpeed(properties.up_speed_avg)}` : '—'],
          ['Sources / pairs', properties ? `${properties.seeds} (${properties.seeds_total}) / ${properties.peers} (${properties.peers_total})` : `${torrent.num_seeds} / ${torrent.num_leechs}`],
          ['Temps actif', duration(properties?.time_elapsed)],
          ['Temps de partage', duration(properties?.seeding_time ?? torrent.seeding_time)],
          ['Limite de ratio', limit(torrent.ratio_limit, formatRatio)],
          ['Limite de partage', limit(torrent.seeding_time_limit, (minutes) => formatEta(minutes * 60))],
          ['Ajouté le', at(torrent.added_on)],
          ['Terminé le', at(torrent.completion_on)],
          ['Tracker', trackerName(torrent.tracker)],
          ['Catégorie', torrent.category || '—'],
          ['Tags', splitTags(torrent.tags).join(', ') || '—'],
          ['Dossier', <span key="dossier" className="font-mono text-footnote">{torrent.save_path || '—'}</span>],
          ['Pièces', properties ? `${properties.pieces_have} / ${properties.pieces_num} de ${formatBytes(properties.piece_size)}` : '—'],
          ['Créé par', properties?.created_by || '—'],
          ['Hash', <span key="hash" className="font-mono text-footnote break-all">{torrent.hash}</span>],
          [
            'Commentaire',
            commentUrl ? (
              <a key="commentaire" href={commentUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 break-all text-accent-muted hover:underline">
                Page du torrent
                <ExternalIcon size={14} aria-hidden />
              </a>
            ) : (
              comment || '—'
            ),
          ],
        ]}
      />
    </Panel>
  )
}

const FILE_PRIORITY: Record<number, string> = { 0: 'Ignoré', 1: 'Normale', 6: 'Haute', 7: 'Maximale' }

export function FilesSection({ files }: { files: TorrentFile[] }) {
  const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }))
  return (
    <Panel title={`Fichiers (${files.length})`}>
      <ul className="flex flex-col divide-y divide-glass-border">
        {sorted.slice(0, 500).map((file) => (
          <li key={file.index} className="flex flex-col gap-1.5 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <span className="min-w-0 font-mono text-footnote break-all text-text">{file.name}</span>
              <span className="shrink-0 font-mono text-footnote text-text-secondary">{formatBytes(file.size)}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <ProgressBar value={file.progress * 100} label={`Progression de ${file.name}`} />
              </div>
              <span className="w-28 shrink-0 text-right text-caption text-text-muted">
                {Math.round(file.progress * 100)} % · {FILE_PRIORITY[file.priority] ?? 'Normale'}
              </span>
            </div>
          </li>
        ))}
      </ul>
      {files.length > 500 && <p className="mt-2 text-footnote text-text-muted">Les 500 premiers fichiers sont affichés.</p>}
    </Panel>
  )
}

const TRACKER_STATUS: Record<number, [string, 'success' | 'warning' | 'neutral' | 'error']> = {
  0: ['Désactivé', 'neutral'],
  1: ['Pas encore contacté', 'neutral'],
  2: ['Fonctionne', 'success'],
  3: ['Mise à jour', 'warning'],
  4: ['Erreur', 'error'],
}

export function TrackersSection({ trackers }: { trackers: TorrentTracker[] }) {
  // DHT, PeX et LSD apparaissent comme des trackers « ** » : ils n'apprennent rien ici.
  const real = trackers.filter((tracker) => !tracker.url.startsWith('**'))
  return (
    <Panel title="Trackers">
      {real.length === 0 ? (
        <p className="text-body text-text-secondary">Aucun tracker (DHT seulement).</p>
      ) : (
        <ul className="flex flex-col divide-y divide-glass-border">
          {real.map((tracker) => {
            const [label, tone] = TRACKER_STATUS[tracker.status] ?? ['Inconnu', 'neutral']
            return (
              <li key={`${tracker.tier}-${tracker.url}`} className="flex flex-col gap-1 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0 text-subhead font-semibold break-all text-text">{trackerName(tracker.url)}</span>
                  <Badge label={label} tone={tone} />
                </div>
                <p className="text-footnote text-text-muted">
                  {tracker.num_seeds >= 0 ? `${tracker.num_seeds} sources · ${tracker.num_leeches} pairs · ${tracker.num_downloaded} téléchargements` : 'Pas de statistiques'}
                  {tracker.msg ? ` · ${tracker.msg}` : ''}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

export function PeersSection({ peers }: { peers: TorrentPeer[] }) {
  const sorted = [...peers].sort((a, b) => b.dl_speed + b.up_speed - (a.dl_speed + a.up_speed))
  return (
    <Panel title={`Pairs connectés (${peers.length})`}>
      {peers.length === 0 ? (
        <p className="text-body text-text-secondary">Aucun pair connecté.</p>
      ) : (
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[560px] text-left text-footnote">
            <thead className="text-text-muted">
              <tr>
                <th scope="col" className="pb-2 font-medium">Adresse</th>
                <th scope="col" className="pb-2 font-medium">Client</th>
                <th scope="col" className="pb-2 text-right font-medium">Progression</th>
                <th scope="col" className="pb-2 text-right font-medium">↓</th>
                <th scope="col" className="pb-2 text-right font-medium">↑</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-border font-mono text-text-secondary">
              {sorted.slice(0, 100).map((peer) => (
                <tr key={`${peer.ip}:${peer.port}`}>
                  <td className="py-2 pr-3 text-text">
                    {peer.country_code ? <span className="mr-1.5 uppercase text-text-muted">{peer.country_code}</span> : null}
                    {peer.ip}
                  </td>
                  <td className="max-w-40 truncate py-2 pr-3 font-sans">{peer.client || '—'}</td>
                  <td className="py-2 text-right">{Math.round(peer.progress * 100)} %</td>
                  <td className="py-2 pl-3 text-right">{formatSpeed(peer.dl_speed)}</td>
                  <td className="py-2 pl-3 text-right">{formatSpeed(peer.up_speed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

const SOURCE_LABELS: Record<LinkedMedia['source'], string> = {
  radarr: 'Suivi par Radarr',
  sonarr: 'Suivi par Sonarr',
  nom: 'Deviné d’après le nom du torrent',
}

export function MediaSection({ media }: { media: LinkedMedia | null }) {
  if (!media) {
    return (
      <Panel title="Média">
        <p className="text-body text-text-secondary">Ni Radarr ni Sonarr ne connaissent ce torrent, et son nom ne correspond à aucun film ou série de TMDB.</p>
      </Panel>
    )
  }
  return (
    <Panel title="Média">
      <div className="flex gap-4">
        <Poster path={media.posterPath} title={media.title} sizes="80px" source="w185" className="w-20 shrink-0" />
        <div className="flex min-w-0 flex-col gap-2">
          <Link href={mediaHref(media.mediaType, media.tmdbId)} className="text-headline font-semibold text-text hover:underline">
            {media.title}
            {media.year ? <span className="font-normal text-text-secondary"> ({media.year})</span> : null}
          </Link>
          <p className="text-footnote text-text-muted">
            {media.mediaType === 'movie' ? 'Film' : 'Série'}
            {media.seasons.length > 0 ? ` · ${formatSeasons(media.seasons)}` : ''} · {SOURCE_LABELS[media.source]}
          </p>
          {media.requests.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {media.requests.map((request) => (
                <li key={`${request.requester}-${request.seasonNumber ?? 'film'}`} className="flex flex-wrap items-center gap-2 text-footnote text-text-secondary">
                  <RequestStatusBadge status={request.status} />
                  {request.seasonNumber !== null ? `Saison ${request.seasonNumber} · ` : ''}demandé par {request.requester}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Panel>
  )
}
