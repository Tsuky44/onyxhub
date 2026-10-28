import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'
import { proxy } from './proxy'

const post = (path: string) => proxy(new NextRequest(`http://hub.test${path}`, { method: 'POST' }))

describe('premier filtre sans session', () => {
  it.each(['/api/integration/sorraa/events', '/api/integration/sorraa/downloads', '/api/request'])(
    'laisse passer %s, qui vérifie la clé d’intégration lui-même',
    (path) => {
      expect(post(path).headers.get('location')).toBeNull()
    },
  )

  it('renvoie une page vers la connexion', () => {
    expect(post('/demandes/liste').headers.get('location')).toContain('/connexion')
  })
})
