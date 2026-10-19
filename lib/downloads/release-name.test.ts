import { describe, expect, it } from 'vitest'
import { guessRelease } from './release-name'

describe('nom de release', () => {
  it("trouve le titre et l'année d'un film", () => {
    expect(guessRelease('The.Matrix.1999.MULTi.1080p.BluRay.x264-GROUP.mkv')).toEqual({ title: 'The Matrix', year: 1999, mediaType: 'movie', season: null })
  })

  it('reconnaît une saison de série', () => {
    expect(guessRelease('Severance.S02.MULTi.2160p.WEB-DL')).toMatchObject({ title: 'Severance', mediaType: 'tv', season: 2 })
    expect(guessRelease('[Team] Arcane Saison 1 VOSTFR')).toMatchObject({ title: 'Arcane', mediaType: 'tv', season: 1 })
  })

  it('ne devine rien sans titre exploitable', () => {
    expect(guessRelease('1080p.x264')).toBeNull()
  })
})
