import { describe, expect, it } from 'vitest'
import { mockFetch } from '@/tests/fetch-mock'
import { fetchOnyxShowEpisodes } from '../services/onyx/library'
import { withOnyxEpisode } from './onyx-episodes'

describe('les épisodes qu’Onyx peut lire', () => {
  it('lit les saisons et ignore ce qui n’est pas un numéro', async () => {
    mockFetch([{ match: /\/api\/library\/shows\/1399\/episodes$/, body: { seasons: { '1': [1, 2, 0, 'x'], '2': [5], oops: [3] } } }])
    const seasons = await fetchOnyxShowEpisodes('http://onyx:8080', 't', 1399)
    expect([...(seasons.get(1) ?? [])]).toEqual([1, 2])
    expect([...(seasons.get(2) ?? [])]).toEqual([5])
    expect(seasons.size).toBe(2)
  })

  it('marque disponible un épisode qu’Onyx lit même quand sorraa ou Sonarr ne l’ont pas importé', async () => {
    mockFetch([{ match: /episodes$/, body: { seasons: { '1': [3] } } }])
    const onyx = await fetchOnyxShowEpisodes('http://onyx:8080', 't', 1)
    expect(withOnyxEpisode(false, onyx, 1, 3)).toBe(true)
    expect(withOnyxEpisode(null, onyx, 1, 3)).toBe(true)
  })

  it('garde l’avis de sorraa ou Sonarr pour un épisode qu’Onyx n’a pas', async () => {
    mockFetch([{ match: /episodes$/, body: { seasons: { '1': [3] } } }])
    const onyx = await fetchOnyxShowEpisodes('http://onyx:8080', 't', 1)
    expect(withOnyxEpisode(true, onyx, 1, 4)).toBe(true)
    expect(withOnyxEpisode(false, onyx, 2, 3)).toBe(false)
    expect(withOnyxEpisode(null, onyx, 1, 4)).toBeNull()
  })

  it('sans réponse d’Onyx, rien ne change', () => {
    expect(withOnyxEpisode(false, null, 1, 3)).toBe(false)
    expect(withOnyxEpisode(null, null, 1, 3)).toBeNull()
  })
})
