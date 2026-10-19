import { describe, expect, it } from 'vitest'
import { mergeDisks } from './admin'
import { formatDuration, greeting, onyxPoster } from './greeting'

describe('accueil', () => {
  it('dit bonjour le jour et bonsoir le soir', () => {
    expect(greeting(9)).toBe('Bonjour')
    expect(greeting(19)).toBe('Bonsoir')
    expect(greeting(2)).toBe('Bonsoir')
  })

  it('écrit les longues durées en jours et heures', () => {
    expect(formatDuration(3 * 86_400 + 4 * 3600)).toBe('3 j 4 h')
    expect(formatDuration(5 * 3600 + 12 * 60)).toBe('5 h 12')
    expect(formatDuration(42 * 60)).toBe('42 min')
  })

  it("réduit les affiches TMDB d'Onyx et refuse les hôtes inconnus", () => {
    expect(onyxPoster('https://image.tmdb.org/t/p/original/abc.jpg')).toBe('https://image.tmdb.org/t/p/w185/abc.jpg')
    expect(onyxPoster('https://assets.fanart.tv/x.jpg')).toBe('https://assets.fanart.tv/x.jpg')
    expect(onyxPoster('http://192.168.1.10/poster.jpg')).toBeNull()
  })

  it("ne montre qu'une fois un disque vu par Radarr et par Sonarr, le plus plein d'abord", () => {
    const disks = mergeDisks([
      [{ path: '/films', freeSpace: 100, totalSpace: 1000 }],
      [
        { path: '/series', freeSpace: 100, totalSpace: 1000 },
        { path: '/data', freeSpace: 10, totalSpace: 1000 },
      ],
    ])
    expect(disks.map((disk) => disk.path)).toEqual(['/data', '/films'])
  })
})
