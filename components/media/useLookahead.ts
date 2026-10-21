'use client'

import { useEffect, useState } from 'react'

/**
 * Les lots suivants d'une liste à défilement infini, chargés d'avance.
 *
 * Mesuré au banc (TMDB à 250 ms, 1 280 px) : attendre la sentinelle pour
 * demander le lot laissait la page bloquée en bas jusqu'à 4 s, la requête
 * faisant la queue derrière les affiches du lot visible (six connexions par
 * hôte en HTTP/1.1). Ici, le lot suivant part dès que le précédent arrive, et
 * `warm` précharge ses affiches : quand la sentinelle se déclenche, `take`
 * rend un lot déjà là.
 *
 * `depth` lots d'avance au plus. Un chargement en échec est refait par
 * `take` : l'erreur n'apparaît que si le refaire échoue aussi.
 */
export interface LookaheadOptions<Cursor, Page> {
  load: (cursor: Cursor) => Promise<Page>
  /** Le curseur du lot qui suit `page`, ou `null` à la fin. */
  next: (page: Page) => Cursor | null
  warm?: (page: Page) => void
  depth?: number
}

export class Lookahead<Cursor, Page> {
  private readonly ahead = new Map<Cursor, Promise<Page>>()

  constructor(private options: LookaheadOptions<Cursor, Page>) {}

  /** Les options du dernier rendu (la source et ses fermetures changent avec lui). */
  configure(options: LookaheadOptions<Cursor, Page>): void {
    this.options = options
  }

  /**
   * Le prochain lot dont la liste aura besoin. Des lots d'avance qui ne le
   * contiennent pas sont périmés (retour à une position mémorisée) : on les
   * oublie.
   */
  prime(cursor: Cursor): void {
    if (!this.ahead.has(cursor)) this.ahead.clear()
    this.extend(cursor)
  }

  async take(cursor: Cursor): Promise<Page> {
    const pending = this.ahead.get(cursor)
    if (pending) this.ahead.delete(cursor)
    else this.ahead.clear()
    const page = pending ? await pending.catch(() => this.options.load(cursor)) : await this.options.load(cursor)
    this.extend(this.options.next(page))
    return page
  }

  /** Oublie les lots d'avance : la liste a changé (suppression, actualisation). */
  clear(): void {
    this.ahead.clear()
  }

  /** Charge `cursor` s'il reste de la place, puis la suite de la chaîne. */
  private extend(cursor: Cursor | null): void {
    if (cursor === null) return
    const known = this.ahead.get(cursor)
    if (known) {
      // Déjà en route : on prolonge au-delà, une place vient peut-être de se libérer.
      known.then(
        (page) => {
          if (this.ahead.get(cursor) === known) this.extend(this.options.next(page))
        },
        () => {
          // L'échec est traité par `take`.
        },
      )
      return
    }
    if (this.ahead.size >= (this.options.depth ?? 1)) return
    const pending = this.options.load(cursor)
    this.ahead.set(cursor, pending)
    pending.then(
      (page) => {
        if (this.ahead.get(cursor) !== pending) return
        this.options.warm?.(page)
        this.extend(this.options.next(page))
      },
      () => {
        // Rien à montrer ici : `take` refera le chargement et affichera l'erreur s'il échoue encore.
      },
    )
  }
}

/** Un `Lookahead` par liste affichée, qui suit les dernières options du rendu. */
export function useLookahead<Cursor, Page>(options: LookaheadOptions<Cursor, Page>): Lookahead<Cursor, Page> {
  const [lookahead] = useState(() => new Lookahead(options))
  useEffect(() => {
    lookahead.configure(options)
  })
  return lookahead
}
