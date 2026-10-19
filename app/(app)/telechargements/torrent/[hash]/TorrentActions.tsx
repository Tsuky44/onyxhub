'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { PauseIcon, PlayIcon, PriorityBottomIcon, PriorityTopIcon, ReannounceIcon, ShareLimitIcon, TrashIcon } from '@/lib/icons'
import { torrentCommandAction, type ActionResult, type TorrentCommand } from '../../actions'
import { DeleteDialog, ShareLimitsDialog } from '../../_torrents/TorrentDialogs'

/** Les actions sur un torrent depuis sa page. Après suppression, retour à la liste. */
export function TorrentActions({ hash, name, paused, queued }: { hash: string; name: string; paused: boolean; queued: boolean }) {
  const router = useRouter()
  const [dialog, setDialog] = useState<'delete' | 'limits' | null>(null)
  const [feedback, setFeedback] = useState<ActionResult | null>(null)
  const [pending, startTransition] = useTransition()

  const run = (command: TorrentCommand) =>
    startTransition(async () => {
      const result = await torrentCommandAction([hash], command)
      setFeedback(result)
      if (result.ok) router.refresh()
    })

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={pending} onClick={() => run(paused ? 'resume' : 'pause')}>
          {paused ? <PlayIcon size={16} aria-hidden /> : <PauseIcon size={16} aria-hidden />}
          {paused ? 'Reprendre' : 'Pause'}
        </Button>
        <Button variant="secondary" disabled={pending} onClick={() => run('reannounce')}>
          <ReannounceIcon size={16} aria-hidden />
          Réannoncer
        </Button>
        {queued && (
          <>
            <Button variant="ghost" disabled={pending} onClick={() => run('top')} aria-label="Placer en tête de file">
              <PriorityTopIcon size={16} aria-hidden />
            </Button>
            <Button variant="ghost" disabled={pending} onClick={() => run('bottom')} aria-label="Placer en fin de file">
              <PriorityBottomIcon size={16} aria-hidden />
            </Button>
          </>
        )}
        <Button variant="ghost" onClick={() => setDialog('limits')}>
          <ShareLimitIcon size={16} aria-hidden />
          Limites
        </Button>
        <Button variant="danger-quiet" onClick={() => setDialog('delete')}>
          <TrashIcon size={16} aria-hidden />
          Supprimer
        </Button>
      </div>
      {feedback && (
        <p role="status" className={cn('text-footnote', feedback.ok ? 'text-success' : 'text-error')}>
          {feedback.message}
        </p>
      )}
      <DeleteDialog
        key={dialog === 'delete' ? 'suppression-ouverte' : 'suppression'}
        hashes={dialog === 'delete' ? [hash] : []}
        names={[name]}
        onClose={() => setDialog(null)}
        onDone={() => {
          router.push('/telechargements')
          router.refresh()
        }}
      />
      <ShareLimitsDialog
        key={dialog === 'limits' ? 'limites-ouvertes' : 'limites'}
        hashes={dialog === 'limits' ? [hash] : []}
        onClose={() => setDialog(null)}
        onDone={(result) => {
          setDialog(null)
          setFeedback(result)
          router.refresh()
        }}
      />
    </div>
  )
}
