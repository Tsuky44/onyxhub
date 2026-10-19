import { describe, expect, it } from 'vitest'
import { rootSegments } from './client'
import { breadcrumbs, InvalidPathError, parentPath, smbPath, splitPath } from './paths'

describe('chemins du partage', () => {
  it('refuse de remonter au-dessus du dossier racine', () => {
    expect(() => splitPath('films/../../etc')).toThrow(InvalidPathError)
    expect(() => splitPath('..\\secret')).toThrow(InvalidPathError)
  })

  it('refuse les caractères de contrôle', () => {
    expect(() => splitPath('films/\u0000')).toThrow(InvalidPathError)
  })

  it('normalise barres obliques, points et segments vides', () => {
    expect(splitPath('/films//./2024\\été/')).toEqual(['films', '2024', 'été'])
    expect(parentPath('films/2024')).toBe('films')
  })

  it('construit le chemin SMB sous le dossier racine', () => {
    expect(smbPath('downloads', 'films/a.mkv')).toBe('downloads\\films\\a.mkv')
    expect(smbPath('', '')).toBe('')
  })

  it('retire un \\\\hôte\\partage collé devant le dossier racine', () => {
    expect(rootSegments({ host: 'nas', share: 'data', rootPath: '\\\\NAS\\data\\downloads' })).toEqual(['downloads'])
    expect(rootSegments({ host: 'nas', share: 'data', rootPath: 'data/downloads' })).toEqual(['data', 'downloads'])
  })

  it('donne un fil d’Ariane depuis la racine', () => {
    expect(breadcrumbs('films/2024').map((crumb) => crumb.path)).toEqual(['', 'films', 'films/2024'])
  })
})
