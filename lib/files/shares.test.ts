import { Readable } from 'node:stream'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTempDataDir } from '@/tests/temp-db'

createTempDataDir()

// Le partage SMB est simulé : on vérifie l'accès au lien, pas le protocole.
const smb = {
  stat: vi.fn(async () => ({ kind: 'file' as const, size: 5, modifiedAt: 0 })),
  readStream: vi.fn(async () => Readable.from([Buffer.from('video')])),
  zipStream: vi.fn(),
  list: vi.fn(),
  remove: vi.fn(),
}
vi.mock('../services/smb/client', () => ({ getSmb: () => smb }))

const { getDb } = await import('../db')
const { fileShares } = await import('../db/schema')
const shares = await import('./shares')
const route = await import('@/app/api/partage/[token]/route')

const context = (token: string) => ({ params: Promise.resolve({ token }) })
const post = (token: string, password: string) => {
  const form = new FormData()
  form.set('motDePasse', password)
  return route.POST(new Request(`http://onyxhub.test/api/partage/${token}`, { method: 'POST', body: form }), context(token))
}

beforeEach(() => {
  getDb().delete(fileShares).run()
})

describe('mots de passe des liens', () => {
  it('ne garde pas le mot de passe en clair et le vérifie', async () => {
    const stored = await shares.hashPassword('secret')
    expect(stored).not.toContain('secret')
    expect(await shares.verifyPassword('secret', stored)).toBe(true)
    expect(await shares.verifyPassword('Secret', stored)).toBe(false)
  })
})

describe('liens de partage', () => {
  it('révoque les liens sous un dossier supprimé, pas ceux d’un dossier voisin', async () => {
    await shares.createShare({ path: 'films/a.mkv', kind: 'file', duration: '7', password: null, createdBy: 'admin' })
    await shares.createShare({ path: 'films2/b.mkv', kind: 'file', duration: '7', password: null, createdBy: 'admin' })
    shares.revokeSharesUnder('films')
    expect(shares.listShares().map((share) => share.path)).toEqual(['films2/b.mkv'])
  })

  it('télécharge un lien sans mot de passe et compte le téléchargement', async () => {
    const share = await shares.createShare({ path: 'films/a.mkv', kind: 'file', duration: '1', password: null, createdBy: 'admin' })
    const response = await route.GET(new Request(`http://onyxhub.test/api/partage/${share.token}`), context(share.token))
    expect(response.status).toBe(200)
    expect(response.headers.get('content-disposition')).toContain('a.mkv')
    expect(await response.text()).toBe('video')
    expect(shares.listShares()[0]?.downloads).toBe(1)
  })

  it('exige le mot de passe, sans jamais le lire dans l’URL', async () => {
    const share = await shares.createShare({ path: 'films/a.mkv', kind: 'file', duration: '7', password: 'secret', createdBy: 'admin' })
    const viaUrl = await route.GET(new Request(`http://onyxhub.test/api/partage/${share.token}?motDePasse=secret`), context(share.token))
    expect(viaUrl.status).toBe(303)
    expect((await post(share.token, 'faux')).headers.get('location')).toContain('erreur=mot-de-passe')
    expect((await post(share.token, 'secret')).status).toBe(200)
  })

  it('bloque après cinq mauvais mots de passe', async () => {
    const share = await shares.createShare({ path: 'films/a.mkv', kind: 'file', duration: '7', password: 'secret', createdBy: 'admin' })
    for (let attempt = 0; attempt < 5; attempt++) await post(share.token, 'faux')
    expect((await post(share.token, 'secret')).headers.get('location')).toContain('erreur=essais')
  })

  it('refuse un lien expiré ou inconnu', async () => {
    const share = await shares.createShare({ path: 'films/a.mkv', kind: 'file', duration: '1', password: null, createdBy: 'admin' })
    getDb().update(fileShares).set({ expiresAt: new Date(Date.now() - 1_000) }).run()
    expect((await route.GET(new Request('http://onyxhub.test/x'), context(share.token))).status).toBe(404)
    expect((await route.GET(new Request('http://onyxhub.test/x'), context('inconnu-inconnu-inconnu'))).status).toBe(404)
  })
})
