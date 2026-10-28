import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

beforeAll(() => {
  process.env.ONYXHUB_DATA_DIR = mkdtempSync(join(tmpdir(), 'onyxhub-test-'))
  delete process.env.ONYXHUB_INTEGRATION_KEY
})

const { setSettings } = await import('../settings/store')
const { resolveSorraaCaller } = await import('../auth/caller')
const { describeSorraaLink } = await import('./sorraa-link')

const push = (key?: string) =>
  resolveSorraaCaller(new Request('http://hub.test/api/integration/sorraa/downloads', { method: 'POST', headers: key ? { Authorization: `Bearer ${key}` } : {} }))

describe('clé de sorraa', () => {
  beforeEach(() => setSettings({ sorraa_hub_key: 'cle-sorraa', integration_api_key: 'cle-onyx' }))

  it('accepte la clé propre à sorraa', () => {
    expect(push('cle-sorraa').ok).toBe(true)
  })

  it("accepte encore la clé d'Onyx, celle des liaisons faites à la main", () => {
    expect(push('cle-onyx').ok).toBe(true)
  })

  it('refuse un envoi sans clé ou avec une autre clé', () => {
    expect(push().ok).toBe(false)
    expect(push('autre').ok).toBe(false)
  })

  it('refuse tout quand OnyxHub n’a encore aucune clé', () => {
    setSettings({ sorraa_hub_key: '', integration_api_key: '' })
    expect(push('cle-sorraa').ok).toBe(false)
  })
})

describe('état de la liaison vu depuis sorraa', () => {
  it('dit que les barres restent vides tant que sorraa n’est pas relié', () => {
    expect(describeSorraaLink({ linked: false }, null)).toMatchObject({ good: false, text: expect.stringContaining('pas relié') })
  })

  it('donne la raison du dernier envoi refusé', () => {
    const state = describeSorraaLink({ linked: true, url: 'http://hub:4400', lastError: 'HTTP 401' }, null)
    expect(state).toMatchObject({ good: false, text: expect.stringContaining('HTTP 401') })
  })

  it("signale une liaison vers une autre adresse que celle fixée", () => {
    expect(describeSorraaLink({ linked: true, url: 'http://ancien:4400' }, 'http://hub:4400').good).toBe(false)
  })

  it('confirme une liaison qui marche', () => {
    expect(describeSorraaLink({ linked: true, url: 'http://hub:4400/' }, 'http://hub:4400')).toMatchObject({ good: true })
  })
})
