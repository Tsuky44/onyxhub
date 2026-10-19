import type { Metadata } from 'next'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { safeNextPath } from '@/lib/auth/next-path'
import { getOptionalViewer } from '@/lib/auth/viewer'
import { onyxBaseUrl } from '@/lib/services/onyx/auth'
import { LoginForm } from './LoginForm'

export const metadata: Metadata = { title: 'Connexion' }

async function alreadySignedIn(): Promise<boolean> {
  try {
    return (await getOptionalViewer()) !== null
  } catch {
    // Onyx injoignable : on montre le formulaire, qui dira l'erreur à l'envoi.
    return false
  }
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ suite?: string }> }) {
  const next = safeNextPath((await searchParams).suite)
  if (onyxBaseUrl() && (await alreadySignedIn())) redirect(next)

  return (
    <main className="login-backdrop flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <div className="mb-8 flex items-center gap-3">
        <Image src="/brand/onyx-mark.svg" alt="" width={40} height={40} priority />
        <Image src="/brand/onyx-wordmark.svg" alt="Onyx" width={77} height={18} priority />
        <span className="font-mono text-footnote font-medium tracking-wide text-text-secondary">HUB</span>
      </div>
      <LoginForm next={next} needsServer={!onyxBaseUrl()} />
    </main>
  )
}
