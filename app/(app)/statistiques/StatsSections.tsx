import Image from 'next/image'
import { Badge } from '@/components/media/StatusBadge'
import { Panel, PanelError, ProgressBar, Stat } from '@/components/ui/Panel'
import { readSession } from '@/lib/auth/session'
import { arrSummary, downloadsSummary, onyxStats, onyxSummary } from '@/lib/home/admin'
import { formatDuration, onyxPoster } from '@/lib/home/greeting'
import { ExternalIcon, PlayIcon, WarningIcon } from '@/lib/icons'
import { formatBytes } from '@/lib/requests/format'

/** Le résumé du serveur, bloc par bloc ; chacun se charge dans son propre Suspense. */

async function token(): Promise<string> {
  return (await readSession())?.token ?? ''
}

const PLAY_METHODS: Record<string, string> = { direct: 'Lecture directe', direct_stream: 'Flux direct', transcode: 'Transcodage', local: 'Fichier local' }

export async function OnyxServer() {
  const result = await onyxSummary(await token())
  if (!result.ok) {
    return (
      <Panel title="Onyx">
        <PanelError message={result.message} />
      </Panel>
    )
  }
  const { server, nowPlaying, scan } = result.value
  const scanning = server.scanning || scan?.is_scanning || scan?.is_backfilling_metadata
  return (
    <Panel title="Lectures en cours" aside={scanning ? <Badge label="Analyse de la bibliothèque" tone="accent" /> : undefined}>
      {nowPlaying.length === 0 ? (
        <p className="text-body text-text-secondary">Personne ne regarde quoi que ce soit en ce moment.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {nowPlaying.map((session) => {
            const poster = onyxPoster(session.poster_url)
            const progress = session.duration_seconds > 0 ? (session.position_seconds / session.duration_seconds) * 100 : 0
            return (
              <li key={session.session_id} className="flex items-center gap-3">
                <div className="relative aspect-[2/3] w-11 shrink-0 overflow-hidden rounded-card bg-elevated">
                  {poster ? (
                    <Image src={poster} alt="" fill sizes="44px" className="object-cover" />
                  ) : (
                    <PlayIcon size={16} aria-hidden className="absolute inset-0 m-auto text-text-muted" />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-subhead font-semibold text-text">{session.show_title ?? session.title}</p>
                    <p className="shrink-0 text-footnote text-text-secondary">{session.username}</p>
                  </div>
                  <p className="truncate text-footnote text-text-muted">
                    {[session.show_title ? session.title : session.subtitle, session.device_name, PLAY_METHODS[session.play_method] ?? session.play_method, session.quality, session.paused ? 'En pause' : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  <ProgressBar value={progress} label={`Lecture de ${session.title} par ${session.username}`} tone={session.paused ? 'warning' : 'accent'} />
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-glass-border pt-5 sm:grid-cols-4">
        <div>
          <Stat label="Films" value={server.library.movies.toLocaleString('fr-FR')} />
        </div>
        <div>
          <Stat label="Séries" value={server.library.shows.toLocaleString('fr-FR')} hint={`${server.library.episodes.toLocaleString('fr-FR')} épisodes`} />
        </div>
        <div>
          <Stat label="Bibliothèque" value={formatBytes(server.library.total_bytes)} />
        </div>
        <div>
          <Stat label="En ligne depuis" value={formatDuration(server.uptime_seconds)} hint={`${server.users} comptes · ${server.transcodes} transcodage${server.transcodes > 1 ? 's' : ''}`} />
        </div>
      </dl>
    </Panel>
  )
}

export async function OnyxStats() {
  const result = await onyxStats(await token(), 30)
  if (!result.ok) {
    return (
      <Panel title="30 derniers jours">
        <PanelError message={result.message} />
      </Panel>
    )
  }
  const stats = result.value
  const peak = Math.max(1, ...stats.daily.map((day) => day.plays))
  return (
    <Panel title="30 derniers jours">
      <div className="grid grid-cols-3 gap-4">
        <Stat label="Lectures" value={stats.totals.plays.toLocaleString('fr-FR')} />
        <Stat label="Temps regardé" value={formatDuration(stats.totals.watched_seconds)} />
        <Stat label="Spectateurs" value={stats.totals.active_users.toLocaleString('fr-FR')} />
      </div>
      {stats.totals.plays > 0 && stats.daily.length > 0 && (
        <div aria-hidden className="mt-5 flex h-16 items-end gap-0.5">
          {stats.daily.map((day) => (
            <div key={day.date} title={`${day.date} : ${day.plays} lecture(s)`} className="min-h-0.5 flex-1 rounded-t-sm bg-accent/60" style={{ height: `${(day.plays / peak) * 100}%` }} />
          ))}
        </div>
      )}
      {stats.top_media.length > 0 && (
        <>
          <h3 className="mt-5 mb-2 text-footnote font-semibold text-text-secondary">Les plus regardés</h3>
          <ol className="flex flex-col gap-2">
            {stats.top_media.slice(0, 5).map((item, index) => (
              <li key={item.key} className="flex items-baseline gap-3 text-subhead">
                <span className="w-4 shrink-0 font-mono text-text-muted">{index + 1}</span>
                <span className="min-w-0 flex-1 truncate text-text">{item.label}</span>
                <span className="shrink-0 font-mono text-footnote text-text-secondary">{item.plays}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </Panel>
  )
}

export async function Downloads() {
  const result = await downloadsSummary()
  if (!result) return null
  return (
    <Panel title="Téléchargements" href="/telechargements" hrefLabel="Ouvrir">
      {!result.ok ? (
        <PanelError message={result.message} />
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <Stat label="Réception" value={`${formatBytes(result.value.downloadSpeed)}/s`} hint={`${result.value.downloading} en cours`} />
          <Stat label="Envoi" value={`${formatBytes(result.value.uploadSpeed)}/s`} hint={`${result.value.seeding} en partage`} />
          <Stat label="Ratio global" value={result.value.ratio ?? '—'} hint={`${result.value.total} torrent${result.value.total > 1 ? 's' : ''}`} />
          {result.value.freeSpace !== null && <Stat label="Espace libre" value={formatBytes(result.value.freeSpace)} />}
        </div>
      )}
    </Panel>
  )
}

export async function ArrStatus() {
  const summary = await arrSummary()
  if (!summary.radarr && !summary.sonarr) return null
  return (
    <Panel title="Radarr et Sonarr">
      <div className="grid grid-cols-2 gap-4">
        {summary.radarr && <Stat label="File Radarr" value={summary.radarr.queue} hint={summary.radarr.queue > 1 ? 'films' : 'film'} />}
        {summary.sonarr && <Stat label="File Sonarr" value={summary.sonarr.queue} hint={summary.sonarr.queue > 1 ? 'téléchargements' : 'téléchargement'} />}
      </div>

      {summary.health.length > 0 && (
        <ul className="mt-5 flex flex-col gap-2">
          {summary.health.map((check) => (
            <li key={`${check.service}-${check.message}`} className="flex items-start gap-2 text-footnote">
              <WarningIcon size={16} aria-hidden className={check.type === 'error' ? 'mt-px shrink-0 text-error' : 'mt-px shrink-0 text-warning'} />
              <span className="min-w-0 flex-1 text-text-secondary">
                <span className="font-semibold text-text">{check.service}</span> : {check.message}
                {check.wikiUrl && (
                  <a href={check.wikiUrl} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-0.5 text-accent-muted hover:text-text">
                    Aide
                    <ExternalIcon size={11} aria-hidden />
                  </a>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {summary.disks.length > 0 && (
        <ul className="mt-5 flex flex-col gap-3">
          {summary.disks.map((disk) => {
            const used = ((disk.totalSpace - disk.freeSpace) / disk.totalSpace) * 100
            return (
              <li key={`${disk.path}-${disk.totalSpace}`} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3 text-footnote">
                  <span className="truncate font-mono text-text-secondary">{disk.label || disk.path}</span>
                  <span className="shrink-0 text-text-muted">{formatBytes(disk.freeSpace)} libres sur {formatBytes(disk.totalSpace)}</span>
                </div>
                <ProgressBar value={used} label={`Espace utilisé sur ${disk.path}`} tone={used > 95 ? 'error' : used > 85 ? 'warning' : 'accent'} />
              </li>
            )
          })}
        </ul>
      )}

      {summary.errors.map((error) => (
        <p key={error} className="mt-4 text-footnote text-error">
          {error}
        </p>
      ))}
    </Panel>
  )
}
