import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <p className="font-mono text-caption tracking-wider text-text-muted">404</p>
      <h1 className="mt-2 text-title1 font-bold text-text">Cette page n&apos;existe pas</h1>
      <p className="mt-2 max-w-sm text-body text-text-secondary">Le lien est peut-être ancien, ou la page est réservée à l&apos;admin.</p>
      <Link
        href="/"
        className="mt-6 rounded-card bg-primary-fill px-5 py-2.5 text-subhead font-semibold text-on-primary transition-opacity duration-(--motion-micro) ease-onyx hover:opacity-90"
      >
        Retour à l&apos;accueil
      </Link>
    </main>
  )
}
