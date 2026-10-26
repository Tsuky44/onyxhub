import { describe, expect, it } from 'vitest'
import { earliestWaiting, waitingText } from './waiting'

const now = new Date('2026-10-26T12:00:00Z')
const reason = 'release non disponible au téléchargement'

describe('attente d\'une demande', () => {
  it('garde la tentative la plus proche et ignore les demandes qui n\'attendent pas', () => {
    const waiting = earliestWaiting([
      {},
      { waiting: { reason, attempts: 2, nextAttemptAt: '2026-10-26T18:00:00Z' } },
      { waiting: { reason, attempts: 1, nextAttemptAt: '2026-10-26T13:00:00Z' } },
    ])
    expect(waiting).toEqual({ reason, attempts: 1, nextAttemptAt: '2026-10-26T13:00:00Z' })
    expect(earliestWaiting([{}])).toBeNull()
  })

  it('dit pourquoi et quand la recherche reprend', () => {
    const at = (iso: string) => waitingText({ reason, attempts: 1, nextAttemptAt: iso }, now)
    expect(at('2026-10-26T12:42:00Z')).toBe('Release non disponible au téléchargement · nouvelle tentative dans 42 min')
    expect(at('2026-10-26T17:00:00Z')).toBe('Release non disponible au téléchargement · nouvelle tentative dans 5 h')
    expect(at('2026-10-28T12:00:00Z')).toBe('Release non disponible au téléchargement · nouvelle tentative dans 2 j')
    expect(at('2026-10-26T11:00:00Z')).toContain('à la prochaine passe')
  })
})
