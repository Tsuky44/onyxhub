import { describe, expect, it } from 'vitest'
import { Lookahead } from './useLookahead'

type Page = { page: number; hasMore: boolean }

/** Un catalogue de `total` pages qui note ce qu'on lui demande. */
function catalogue(total: number, failOnce?: number) {
  const asked: number[] = []
  let failing = failOnce
  const load = async (page: number): Promise<Page> => {
    asked.push(page)
    if (failing === page) {
      failing = undefined
      throw new Error('TMDB ne répond pas')
    }
    return { page, hasMore: page < total }
  }
  return { asked, load }
}

const next = (page: Page) => (page.hasMore ? page.page + 1 : null)
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('Lookahead', () => {
  it('charge les lots suivants dès que la liste les annonce, jusqu’à la profondeur demandée', async () => {
    const { asked, load } = catalogue(10)
    const warmed: number[] = []
    new Lookahead<number, Page>({ load, next, warm: (page) => warmed.push(page.page), depth: 2 }).prime(2)
    await settle()

    expect(asked).toEqual([2, 3])
    expect(warmed).toEqual([2, 3])
  })

  it('rend le lot préchargé sans le redemander, et garde la même avance', async () => {
    const { asked, load } = catalogue(10)
    const lookahead = new Lookahead<number, Page>({ load, next, depth: 2 })
    lookahead.prime(2)
    await settle()

    expect(await lookahead.take(2)).toEqual({ page: 2, hasMore: true })
    await settle()
    expect(asked).toEqual([2, 3, 4])
  })

  it('redemande un lot dont le préchargement a échoué', async () => {
    const { asked, load } = catalogue(10, 2)
    const lookahead = new Lookahead<number, Page>({ load, next })
    lookahead.prime(2)
    await settle()

    expect(await lookahead.take(2)).toEqual({ page: 2, hasMore: true })
    expect(asked.filter((page) => page === 2)).toHaveLength(2)
  })

  it('ne charge rien au-delà du dernier lot', async () => {
    const { asked, load } = catalogue(3)
    const lookahead = new Lookahead<number, Page>({ load, next, depth: 3 })
    lookahead.prime(2)
    await settle()

    expect(asked).toEqual([2, 3])
  })

  it('oublie l’avance quand la liste repart ailleurs (retour à une position mémorisée)', async () => {
    const { asked, load } = catalogue(20)
    const lookahead = new Lookahead<number, Page>({ load, next, depth: 2 })
    lookahead.prime(2)
    await settle()

    lookahead.prime(8)
    await settle()
    expect(asked).toEqual([2, 3, 8, 9])
    await lookahead.take(8)
    expect(asked.filter((page) => page === 8)).toHaveLength(1)
  })
})
