'use client'

import { useEffect, useState, useTransition } from 'react'
import { Button, buttonClasses } from '@/components/ui/Button'
import { pollPairingAction, startPairingAction, type PairingState } from './pairing-actions'

type Phase = { kind: 'idle' } | PairingState | { kind: 'expired' }

/** `ABCDEFGH` → `ABCD-EFGH`, comme sur l'écran d'un téléviseur. */
function formatCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code
}

/**
 * Se connecter sans mot de passe : un téléphone (ou cet ordinateur) déjà
 * connecté à Onyx approuve le code, comme pour un téléviseur (ADR-0011).
 */
export function AppPairing({ next }: { next: string }) {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [pending, startTransition] = useTransition()

  const start = () => startTransition(async () => setPhase(await startPairingAction()))

  useEffect(() => {
    if (phase.kind !== 'started') return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    const tick = async () => {
      if (Date.now() > phase.expiresAt) return setPhase({ kind: 'expired' })
      const result = await pollPairingAction(phase.ticket, next)
      if (cancelled) return
      if (result.kind === 'approved') {
        // Rechargement complet : les pages serveur relisent le cookie de session tout juste posé.
        window.location.assign(result.next)
        return
      }
      if (result.kind === 'expired') return setPhase({ kind: 'expired' })
      // Une panne passagère d'Onyx ne fait pas perdre le code : on réessaie au tour suivant.
      timer = setTimeout(() => void tick(), phase.interval * 1000)
    }
    timer = setTimeout(() => void tick(), phase.interval * 1000)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [phase, next])

  if (phase.kind === 'idle' || phase.kind === 'error') {
    return (
      <div className="flex flex-col gap-2">
        <Button variant="secondary" className="w-full" pending={pending} onClick={start}>
          Se connecter avec l&apos;app Onyx
        </Button>
        {phase.kind === 'error' && (
          <p role="alert" className="text-subhead text-error">
            {phase.message}
          </p>
        )}
      </div>
    )
  }

  if (phase.kind === 'expired') {
    return (
      <div className="flex flex-col gap-3 rounded-card border border-border bg-elevated p-4">
        <p className="text-subhead text-text-secondary">Ce code a expiré ou a été refusé.</p>
        <Button variant="secondary" pending={pending} onClick={start}>
          Nouveau code
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-elevated p-4">
      <p className="text-subhead text-pretty text-text-secondary">
        Dans l&apos;app Onyx, sur un téléphone déjà connecté : Compte, puis « Connecter un appareil », et saisis ce code. Ou
        approuve-le dans Onyx sur ce navigateur.
      </p>
      <p className="text-center font-mono text-title2 font-semibold tracking-[0.2em] text-text select-all" aria-label={`Code ${phase.userCode.split('').join(' ')}`}>
        {formatCode(phase.userCode)}
      </p>
      <a href={phase.approveUrl} target="_blank" rel="noreferrer" className={buttonClasses('secondary')}>
        Approuver dans Onyx ici
      </a>
      <p role="status" className="flex items-center gap-2 text-footnote text-text-muted">
        <span aria-hidden className="size-3 animate-spin rounded-full border-2 border-current border-r-transparent" />
        En attente de l&apos;approbation…
      </p>
    </div>
  )
}
