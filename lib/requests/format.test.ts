import { describe, expect, it } from 'vitest'
import { formatBytes, formatRuntime, formatSeasons } from './format'

describe('mise en forme', () => {
  it('résume une liste de saisons', () => {
    expect(formatSeasons([2])).toBe('Saison 2')
    expect(formatSeasons([1, 2])).toBe('Saisons 1 et 2')
    expect(formatSeasons([4, 1, 2, 3])).toBe('Saisons 1 à 4')
    expect(formatSeasons([1, 3, 5])).toBe('Saisons 1, 3 et 5')
    expect(formatSeasons([1, 2, 3, 6])).toBe('Saisons 1 à 3 et 6')
  })

  it('écrit les durées et les tailles à la française', () => {
    expect(formatRuntime(135)).toBe('2 h 15')
    expect(formatRuntime(48)).toBe('48 min')
    expect(formatBytes(1.5 * 1024 ** 3)).toBe('1,5 Go')
  })
})
