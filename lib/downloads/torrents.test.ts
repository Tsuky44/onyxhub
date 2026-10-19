import { describe, expect, it } from 'vitest'
import { normalizeTorrent } from '../services/qbittorrent/sync-state'
import type { Torrent } from '../services/qbittorrent/types'
import { parseHashes } from './hashes'
import { applyStreamMessage, EMPTY_LIVE } from './stream-state'
import { DEFAULT_FILTERS, diffTorrents, filterTorrents, formatEta, sortTorrents, toWire, torrentState, trackerName, type TorrentWire } from './torrents'

const HASH_A = 'a'.repeat(40)
const HASH_B = 'b'.repeat(40)

const torrent = (fields: Partial<Torrent> & { hash: string }): TorrentWire => toWire(normalizeTorrent(fields.hash, { state: 'downloading', ...fields }))

describe('garde-fou des actions groupées', () => {
  it('refuse une liste vide, que qBit prendrait pour « tous les torrents »', () => {
    expect(parseHashes([])).toBeNull()
    expect(parseHashes(undefined)).toBeNull()
  })

  it('refuse toute la liste si un seul hash est invalide, et dédoublonne', () => {
    expect(parseHashes([HASH_A, 'all'])).toBeNull()
    expect(parseHashes([HASH_A.toUpperCase(), HASH_A])).toEqual([HASH_A])
  })
})

describe('flux des torrents', () => {
  it("n'envoie que les torrents recréés par le poller, et ceux qui ont disparu", () => {
    const kept = normalizeTorrent(HASH_A, { name: 'A' })
    const sent = new Map([
      [HASH_A, kept],
      [HASH_B, normalizeTorrent(HASH_B, { name: 'B' })],
    ])
    const changed = normalizeTorrent('c'.repeat(40), { name: 'C' })
    const { upsert, removed } = diffTorrents(sent, { [HASH_A]: kept, [changed.hash]: changed })
    expect(upsert.map((item) => item.name)).toEqual(['C'])
    expect(removed).toEqual([HASH_B])
  })

  it("ignore un différentiel arrivé avant l'état complet, puis l'applique", () => {
    const patch = { type: 'patch' as const, upsert: [torrent({ hash: HASH_A, name: 'A' })], removed: [], server: {}, error: null }
    expect(applyStreamMessage(EMPTY_LIVE, patch)).toBe(EMPTY_LIVE)
    const ready = applyStreamMessage(EMPTY_LIVE, { type: 'snapshot', torrents: [torrent({ hash: HASH_B, name: 'B' })], server: {}, categories: ['films'], tags: [], error: null })
    const next = applyStreamMessage(ready, { ...patch, removed: [HASH_B] })
    expect([...next.torrents.keys()]).toEqual([HASH_A])
    expect(next.categories).toEqual(['films'])
  })
})

describe('libellés', () => {
  it('reconnaît les états de qBittorrent 4 et 5', () => {
    expect(torrentState({ state: 'pausedUP' }).label).toBe('Terminé')
    expect(torrentState({ state: 'stoppedDL' }).label).toBe('En pause')
    expect(torrentState({ state: 'missingFiles' }).tone).toBe('error')
  })

  it('nomme un tracker par son domaine', () => {
    expect(trackerName('https://tracker.example.org:8080/announce')).toBe('example.org')
    expect(trackerName('udp://open.demonii.com:1337/announce')).toBe('demonii.com')
    expect(trackerName('')).toBe('Aucun')
  })

  it('écrit un temps restant lisible, infini compris', () => {
    expect(formatEta(8_640_000)).toBe('∞')
    expect(formatEta(7_500)).toBe('2 h 05')
    expect(formatEta(3 * 86_400 + 4 * 3_600)).toBe('3 j 4 h')
  })
})

describe('filtres et tri', () => {
  const list = [
    torrent({ hash: HASH_A, name: 'The.Matrix.1999.MULTi.1080p', category: 'films', tags: 'hd, fr', added_on: 1_780_000_000, eta: 8_640_000, state: 'stalledDL' }),
    torrent({ hash: HASH_B, name: 'Été.Meurtrier.1983', category: '', tags: 'fr', added_on: 1_700_000_000, eta: 120, state: 'uploading' }),
  ]

  it('cherche des mots dans le désordre, sans tenir compte des accents ni des points', () => {
    expect(filterTorrents(list, { ...DEFAULT_FILTERS, search: '1080p matrix' }).map((item) => item.hash)).toEqual([HASH_A])
    expect(filterTorrents(list, { ...DEFAULT_FILTERS, search: 'ete meurtrier' }).map((item) => item.hash)).toEqual([HASH_B])
  })

  it('exige tous les tags choisis, et sait filtrer « sans catégorie »', () => {
    expect(filterTorrents(list, { ...DEFAULT_FILTERS, tags: ['hd', 'fr'] }).map((item) => item.hash)).toEqual([HASH_A])
    expect(filterTorrents(list, { ...DEFAULT_FILTERS, categories: [''] }).map((item) => item.hash)).toEqual([HASH_B])
  })

  it('range les temps restants infinis en dernier, quel que soit l’ordre', () => {
    expect(sortTorrents(list, 'eta', 'desc').map((item) => item.hash)).toEqual([HASH_B, HASH_A])
    expect(sortTorrents(list, 'eta', 'asc').map((item) => item.hash)).toEqual([HASH_B, HASH_A])
  })
})
