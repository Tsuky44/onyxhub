import Link from 'next/link'

/** 404 dans le shell (page admin vue par un membre, lien périmé) : le shell fournit déjà le `<main>`. */
export default function AppNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="font-mono text-caption tracking-wider text-text-muted">404</p>
      <h1 className="mt-2 text-title1 font-bold text-text">Cette page n&apos;existe pas</h1>
      <p className="mt-2 max-w-sm text-body text-text-secondary">Le lien est peut-être ancien, ou la page est réservée à l&apos;admin.</p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-11 items-center rounded-card bg-primary-fill px-5 text-subhead font-semibold text-on-primary transition-colors duration-(--motion-micro) ease-onyx hover:bg-text"
      >
        Retour à l&apos;accueil
      </Link>
    </div>
  )
}
