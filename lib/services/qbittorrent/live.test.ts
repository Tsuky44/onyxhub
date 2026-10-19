import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MainData } from './types'

const mainData = vi.fn<(rid: number) => Promise<MainData>>()
let config: { baseUrl: string; username: string; password: string } | null = { baseUrl: 'http://qbit', username: '', password: '' }

vi.mock('../../settings/store', () => ({ getSetting: () => '2' }))
vi.mock('./client', () => ({
  qbittorrentConfig: () => config,
  createQbittorrent: () => ({ mainData }),
}))

const { QbitLive } = await import('./live')

beforeEach(() => {
  vi.useFakeTimers()
  mainData.mockReset()
  config = { baseUrl: 'http://qbit', username: '', password: '' }
})

afterEach(() => vi.useRealTimers())

describe('qBittorrent en direct', () => {
  it("n'interroge pas qBit tant que personne n'est abonné", async () => {
    new QbitLive()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(mainData).not.toHaveBeenCalled()
  })

  it('suit le rid de qBit pour ne recevoir que les différences', async () => {
    mainData.mockResolvedValueOnce({ rid: 1, full_update: true, torrents: { a: { name: 'A' } } })
    mainData.mockResolvedValue({ rid: 2 })
    const live = new QbitLive()
    const listener = vi.fn()
    live.subscribe(listener)
    await vi.advanceTimersByTimeAsync(2_100)
    expect(mainData.mock.calls.map(([rid]) => rid)).toEqual([0, 1])
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it("s'endort après le départ du dernier abonné", async () => {
    mainData.mockResolvedValue({ rid: 1 })
    const live = new QbitLive()
    const unsubscribe = live.subscribe(() => {})
    await vi.advanceTimersByTimeAsync(100)
    unsubscribe()
    await vi.advanceTimersByTimeAsync(31_000)
    const calls = mainData.mock.calls.length
    await vi.advanceTimersByTimeAsync(60_000)
    expect(mainData.mock.calls.length).toBe(calls)
  })

  it('ralentit après des échecs au lieu de marteler un qBit arrêté', async () => {
    mainData.mockRejectedValue(new Error('qBittorrent est injoignable'))
    const live = new QbitLive()
    live.subscribe(() => {})
    await vi.advanceTimersByTimeAsync(10_000)
    // 0 s, puis 4 s (2 × 2¹), puis 8 s plus tard : 2 appels en 10 s au lieu de 5.
    expect(mainData).toHaveBeenCalledTimes(2)
    expect(live.error()).toBe('qBittorrent est injoignable')
  })

  it('réutilise un état récent pour une lecture ponctuelle', async () => {
    mainData.mockResolvedValue({ rid: 1, full_update: true, torrents: {} })
    const live = new QbitLive()
    await live.snapshot()
    await live.snapshot()
    expect(mainData).toHaveBeenCalledTimes(1)
  })

  it('repart de zéro quand les réglages qBit changent', async () => {
    mainData.mockResolvedValue({ rid: 5, full_update: true, torrents: { a: {} } })
    const live = new QbitLive()
    await live.refresh()
    config = { baseUrl: 'http://autre-qbit', username: '', password: '' }
    await live.refresh()
    expect(mainData.mock.calls.map(([rid]) => rid)).toEqual([0, 0])
  })
})
