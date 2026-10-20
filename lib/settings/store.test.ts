import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

beforeAll(() => {
  process.env.ONYXHUB_DATA_DIR = mkdtempSync(join(tmpdir(), 'onyxhub-test-'))
  delete process.env.ONYXHUB_SECRET
})

afterEach(() => {
  delete process.env.ONYX_URL
})

const { seal, unseal, safeEqual } = await import('../crypto')
const { getSetting, setSettings, snapshotService } = await import('./store')
const { getDb } = await import('../db')
const { settings } = await import('../db/schema')

describe('chiffrement', () => {
  it('retrouve la valeur chiffrée', () => {
    expect(unseal(seal('clé-très-secrète'))).toBe('clé-très-secrète')
  })

  it('rejette une valeur modifiée au lieu de la déchiffrer de travers', () => {
    // Un caractère du milieu : le dernier d'un base64 peut ne porter que des
    // bits ignorés, et le modifier ne changerait alors aucun octet.
    const sealed = seal('jeton')
    const index = Math.floor(sealed.length / 2)
    const swapped = sealed[index] === 'A' ? 'B' : 'A'
    expect(unseal(sealed.slice(0, index) + swapped + sealed.slice(index + 1))).toBeNull()
  })

  it('compare deux secrets sans se tromper sur la longueur', () => {
    expect(safeEqual('abc', 'abc')).toBe(true)
    expect(safeEqual('abc', 'abcd')).toBe(false)
  })
})

describe('réglages', () => {
  it("n'écrit jamais un secret en clair dans la base", () => {
    setSettings({ radarr_api_key: 'cle-radarr-123' })
    const row = getDb().select().from(settings).all().find((candidate) => candidate.key === 'radarr_api_key')
    expect(row?.encrypted).toBe(true)
    expect(row?.value).not.toContain('cle-radarr-123')
    expect(getSetting('radarr_api_key')).toBe('cle-radarr-123')
  })

  it('garde un mot de passe tel quel, espaces au bord comprises', () => {
    setSettings({ qbittorrent_password: ' mot de passe ' })
    expect(getSetting('qbittorrent_password')).toBe(' mot de passe ')
  })

  it("garde une URL en clair, lisible dans une sauvegarde", () => {
    setSettings({ radarr_url: 'http://nas:7878' })
    expect(getSetting('radarr_url')).toBe('http://nas:7878')
  })

  it('efface un réglage enregistré vide', () => {
    setSettings({ radarr_url: 'http://nas:7878' })
    setSettings({ radarr_url: '' })
    expect(getSetting('radarr_url')).toBeUndefined()
  })

  it("donne la priorité à la variable d'environnement et verrouille le champ", () => {
    setSettings({ onyx_url: 'http://base:8080' })
    process.env.ONYX_URL = 'http://env:8080'
    expect(getSetting('onyx_url')).toBe('http://env:8080')
    expect(snapshotService('onyx')[0]).toMatchObject({ value: 'http://env:8080', lockedBy: 'ONYX_URL' })
  })

  it('ne renvoie jamais la valeur d\'un secret au formulaire', () => {
    setSettings({ sonarr_api_key: 'cle-sonarr' })
    const key = snapshotService('sonarr').find((field) => field.key === 'sonarr_api_key')
    expect(key).toMatchObject({ value: '', isSet: true })
  })

  it('applique la valeur par défaut quand rien n\'est enregistré', () => {
    expect(getSetting('qbittorrent_poll_interval')).toBe('5')
  })
})
