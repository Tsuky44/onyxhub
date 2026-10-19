import { describe, expect, it } from 'vitest'
import { countByStatus, filterByStatus, isPaused } from './filters'
import { applyMainData, emptySyncState, normalizeTorrent } from './sync-state'

describe('état synchronisé', () => {
  it('remplace tout sur une réponse complète', () => {
    const before = applyMainData(emptySyncState(), { rid: 1, full_update: true, torrents: { a: { name: 'A' }, b: { name: 'B' } } }).state
    const after = applyMainData(before, { rid: 2, full_update: true, torrents: { c: { name: 'C' } } }).state
    expect(Object.keys(after.torrents)).toEqual(['c'])
    expect(after.rid).toBe(2)
  })

  it('fusionne un différentiel dans le torrent connu sans perdre les autres champs', () => {
    const start = applyMainData(emptySyncState(), {
      rid: 1,
      full_update: true,
      torrents: { a: { name: 'Dune', progress: 0.2, dlspeed: 1000 } },
    }).state
    const { state, changed } = applyMainData(start, { rid: 2, torrents: { a: { progress: 0.5 } } })
    expect(state.torrents.a).toMatchObject({ name: 'Dune', progress: 0.5, dlspeed: 1000 })
    expect(changed).toBe(true)
  })

  it('retire les torrents supprimés', () => {
    const start = applyMainData(emptySyncState(), { rid: 1, full_update: true, torrents: { a: {}, b: {} } }).state
    expect(Object.keys(applyMainData(start, { rid: 2, torrents_removed: ['a'] }).state.torrents)).toEqual(['b'])
  })

  it('tient catégories et tags à jour en différentiel', () => {
    const start = applyMainData(emptySyncState(), {
      rid: 1,
      full_update: true,
      categories: { films: { name: 'films', savePath: '/dl/films' } },
      tags: ['radarr'],
    }).state
    const { state } = applyMainData(start, { rid: 2, categories: { series: { savePath: '/dl/tv' } }, tags: ['sonarr'], tags_removed: ['radarr'] })
    expect(Object.keys(state.categories).sort()).toEqual(['films', 'series'])
    expect(state.tags).toEqual(['sonarr'])
  })

  it("ne signale aucun changement quand qBit n'a rien envoyé", () => {
    expect(applyMainData(emptySyncState(), { rid: 3 }).changed).toBe(false)
  })
})

describe('filtres de statut', () => {
  const torrent = (state: string, extra: Partial<Parameters<typeof normalizeTorrent>[1]> = {}) =>
    normalizeTorrent(state, { state, ...extra })

  it('reconnaît la pause de qBit 5 (stoppedDL/stoppedUP) comme celle de qBit 4', () => {
    expect(isPaused(torrent('stoppedDL'))).toBe(true)
    expect(isPaused(torrent('pausedUP'))).toBe(true)
    expect(isPaused(torrent('downloading'))).toBe(false)
  })

  it('compte un torrent arrêté après partage comme terminé', () => {
    expect(filterByStatus([torrent('stoppedUP')], 'completed')).toHaveLength(1)
  })

  it("dit actif un torrent qui échange, quel que soit son état", () => {
    const counts = countByStatus([torrent('stalledUP', { upspeed: 10 }), torrent('stalledDL')])
    expect(counts.active).toBe(1)
    expect(counts.stalled).toBe(2)
    expect(counts.all).toBe(2)
  })
})
