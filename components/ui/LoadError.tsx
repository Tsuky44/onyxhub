'use client'

import { Button } from './Button'

/**
 * Une page qui n'a pas pu se rendre. En production, Next ne transmet pas le
 * message d'une erreur serveur au navigateur : on dit la cause la plus
 * probable (Onyx injoignable, puisque chaque page lui demande qui regarde) et
 * on propose de réessayer.
 */
export function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-panel border border-glass-border bg-surface px-6 py-16 text-center">
      <h1 className="text-headline font-semibold text-text">Cette page n&apos;a pas pu se charger</h1>
      <p className="mt-1.5 max-w-md text-body text-pretty text-text-secondary">
        Le serveur Onyx ne répond peut-être pas. Vérifie qu&apos;il tourne, puis réessaie.
      </p>
      <Button variant="secondary" className="mt-6" onClick={onRetry}>
        Réessayer
      </Button>
    </div>
  )
}
