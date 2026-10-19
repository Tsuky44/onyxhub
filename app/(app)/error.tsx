'use client'

import { LoadError } from '@/components/ui/LoadError'

/** Une page du shell en erreur : le shell reste, seule la zone de contenu change. */
export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <LoadError onRetry={reset} />
}
