import { vi } from 'vitest'

/**
 * Un `fetch` simulé pour les tests de services : une liste de routes
 * (méthode + motif d'URL → réponse), et l'historique des appels pour vérifier
 * ce qui a été envoyé. Une requête sans route échoue bruyamment, pour qu'un
 * appel inattendu ne passe pas inaperçu.
 */
export interface MockRoute {
  method?: string
  match: RegExp
  status?: number
  body?: unknown
  headers?: Record<string, string>
}

export interface RecordedCall {
  method: string
  url: string
  headers: Headers
  body: string | null
}

export function mockFetch(routes: MockRoute[]) {
  const calls: RecordedCall[] = []
  const fetchMock = vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input instanceof Request ? input.url : input)
    const method = (init.method ?? 'GET').toUpperCase()
    const body = typeof init.body === 'string' ? init.body : init.body instanceof URLSearchParams ? init.body.toString() : null
    calls.push({ method, url, headers: new Headers(init.headers), body })
    const route = routes.find((candidate) => (candidate.method ?? 'GET') === method && candidate.match.test(url))
    if (!route) throw new Error(`fetch simulé : aucune route pour ${method} ${url}`)
    const payload = typeof route.body === 'string' ? route.body : JSON.stringify(route.body ?? null)
    return new Response(payload, { status: route.status ?? 200, headers: route.headers })
  })
  vi.stubGlobal('fetch', fetchMock)
  return { calls, fetchMock }
}
