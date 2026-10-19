'use client'

import { useEffect, useState } from 'react'
import { applyStreamMessage, EMPTY_LIVE, type LiveTorrents } from '@/lib/downloads/stream-state'
import type { StreamMessage } from '@/lib/downloads/torrents'

export type StreamStatus = 'connecting' | 'live' | 'lost'

/**
 * Les torrents en direct depuis `/api/telechargements/flux`. Le flux se ferme
 * quand l'onglet passe en arrière-plan : le poller qBit du serveur peut alors
 * s'endormir. Au retour, un nouvel état complet arrive.
 */
export function useTorrentStream(): LiveTorrents & { status: StreamStatus } {
  const [live, setLive] = useState<LiveTorrents>(EMPTY_LIVE)
  const [status, setStatus] = useState<StreamStatus>('connecting')

  useEffect(() => {
    let source: EventSource | null = null

    const open = () => {
      if (source) return
      source = new EventSource('/api/telechargements/flux')
      source.onopen = () => setStatus('live')
      source.onmessage = (event: MessageEvent<string>) => {
        try {
          const message = JSON.parse(event.data) as StreamMessage
          setLive((current) => applyStreamMessage(current, message))
          setStatus('live')
        } catch {
          // Message tronqué : le suivant (ou l'état complet de la reconnexion) corrige.
        }
      }
      // EventSource se reconnecte seul ; on le signale en attendant.
      source.onerror = () => setStatus('lost')
    }
    const close = () => {
      source?.close()
      source = null
    }
    const onVisibility = () => (document.visibilityState === 'visible' ? open() : close())

    open()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      close()
    }
  }, [])

  return { ...live, status }
}
