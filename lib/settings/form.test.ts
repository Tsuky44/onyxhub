import { describe, expect, it } from 'vitest'
import { parseServiceForm } from './form'
import { findService } from './registry'

function form(entries: Record<string, string>): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(entries)) data.set(key, value)
  return data
}

const radarr = findService('radarr')!
const qbit = findService('qbittorrent')!

describe('formulaire de réglages', () => {
  it("garde l'ancien secret quand le champ est laissé vide", () => {
    const { updates } = parseServiceForm(radarr, form({ radarr_url: 'http://nas:7878', radarr_api_key: '' }), new Set())
    expect(updates).toEqual({ radarr_url: 'http://nas:7878' })
  })

  it("retire le / final d'une URL", () => {
    const { updates } = parseServiceForm(radarr, form({ radarr_url: ' http://nas:7878/ ' }), new Set())
    expect(updates.radarr_url).toBe('http://nas:7878')
  })

  it('refuse une adresse qui n\'est pas en http(s)', () => {
    const { errors } = parseServiceForm(radarr, form({ radarr_url: 'nas:7878' }), new Set())
    expect(errors.radarr_url).toBeDefined()
  })

  it('refuse un rafraîchissement qBit sous 2 secondes', () => {
    const { errors } = parseServiceForm(qbit, form({ qbittorrent_poll_interval: '1' }), new Set())
    expect(errors.qbittorrent_poll_interval).toBe('2 minimum')
  })

  it('ignore un champ verrouillé par une variable d\'environnement', () => {
    const onyx = findService('onyx')!
    const { updates } = parseServiceForm(onyx, form({ onyx_url: 'http://autre:8080' }), new Set(['onyx_url']))
    expect(updates).toEqual({})
  })

  it('efface un champ texte vidé', () => {
    const { updates } = parseServiceForm(radarr, form({ radarr_url: '' }), new Set())
    expect(updates).toEqual({ radarr_url: '' })
  })
})
