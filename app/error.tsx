'use client'

import { LoadError } from '@/components/ui/LoadError'

/** Le shell lui-même n'a pas pu se rendre (il demande le compte à Onyx) : erreur en pleine page. */
export default function RootError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-5">
      <LoadError onRetry={reset} />
    </main>
  )
}
