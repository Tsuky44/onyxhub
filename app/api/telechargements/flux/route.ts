import { adminForRoute } from '@/lib/auth/viewer'
import { diffTorrents, toWire, type StreamMessage } from '@/lib/downloads/torrents'
import { qbitLive } from '@/lib/services/qbittorrent/live'
import type { SyncState } from '@/lib/services/qbittorrent/sync-state'
import type { Torrent } from '@/lib/services/qbittorrent/types'

export const dynamic = 'force-dynamic'

/** Un commentaire SSE régulier empêche un proxy de couper une connexion silencieuse. */
const HEARTBEAT_MS = 25_000

/**
 * Les torrents en direct, en Server-Sent Events : l'état complet à
 * l'ouverture, puis seulement ce qui change à chaque passage du poller
 * (PLAN §4). MediaHub faisait relire toute la liste au navigateur toutes les
 * 5 s ; ici, une page ouverte réveille le poller partagé et le dernier onglet
 * fermé l'endort.
 */
export async function GET(request: Request) {
  const { denied } = await adminForRoute()
  if (denied) return denied

  const live = qbitLive()
  const encoder = new TextEncoder()
  let cleanup = () => {}

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let sent = new Map<string, Torrent>()
      let sentCategories: SyncState['categories'] | null = null
      let sentTags: SyncState['tags'] | null = null
      let closed = false

      const send = (message: StreamMessage | null, comment?: string) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(message ? `data: ${JSON.stringify(message)}\n\n` : `: ${comment ?? ''}\n\n`))
        } catch {
          // Le navigateur est parti entre deux envois : le nettoyage suit.
          cleanup()
        }
      }

      const remember = (state: SyncState) => {
        sent = new Map(Object.entries(state.torrents))
        sentCategories = state.categories
        sentTags = state.tags
      }

      const onChange = (state: SyncState) => {
        const { upsert, removed } = diffTorrents(sent, state.torrents)
        const categoriesChanged = state.categories !== sentCategories
        const tagsChanged = state.tags !== sentTags
        remember(state)
        send({
          type: 'patch',
          upsert: upsert.map(toWire),
          removed,
          server: state.server,
          ...(categoriesChanged ? { categories: Object.keys(state.categories).sort() } : {}),
          ...(tagsChanged ? { tags: state.tags } : {}),
          error: live.error(),
        })
      }

      const unsubscribe = live.subscribe(onChange)
      const heartbeat = setInterval(() => send(null, 'ping'), HEARTBEAT_MS)
      cleanup = () => {
        if (closed) return
        closed = true
        clearInterval(heartbeat)
        unsubscribe()
        try {
          controller.close()
        } catch {
          // Déjà fermé par le navigateur.
        }
      }
      request.signal.addEventListener('abort', () => cleanup(), { once: true })

      const state = await live.snapshot()
      remember(state)
      send({
        type: 'snapshot',
        torrents: Object.values(state.torrents).map(toWire),
        server: state.server,
        categories: Object.keys(state.categories).sort(),
        tags: state.tags,
        error: live.error(),
      })
    },
    cancel() {
      cleanup()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Nginx : pas de mise en tampon, sinon les événements arrivent par paquets.
      'X-Accel-Buffering': 'no',
    },
  })
}
