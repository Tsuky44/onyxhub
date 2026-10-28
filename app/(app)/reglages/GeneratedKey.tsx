'use client'

import { useState, useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/Button'
import { CopyIcon } from '@/lib/icons'

function CopyRow({ label, value }: { label?: string; value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="mt-3">
      {label && <p className="mb-1.5 text-footnote font-medium text-text-secondary">{label}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 rounded-card bg-bg px-3 py-2 font-mono text-subhead break-all text-text select-all">{value}</code>
        <Button
          variant="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value)
              setCopied(true)
            } catch {
              // Presse-papiers refusé (HTTP hors localhost) : la valeur reste sélectionnable à la main.
              setCopied(false)
            }
          }}
        >
          <CopyIcon size={16} aria-hidden />
          {copied ? 'Copié' : 'Copier'}
        </Button>
      </div>
    </div>
  )
}

const noSubscribe = () => () => {}

/**
 * Un secret qu'on vient de générer, montré une seule fois. Pour les
 * webhooks, on donne directement les deux URL à coller dans Radarr et
 * Sonarr, secret compris.
 */
export function GeneratedKey({ serviceId, value }: { serviceId: string; value: string }) {
  // L'adresse d'OnyxHub telle que le navigateur la voit ; rien côté serveur.
  const origin = useSyncExternalStore(noSubscribe, () => window.location.origin, () => '')
  const webhooks = serviceId === 'webhooks'
  return (
    <div className="mx-5 mb-5 rounded-card border border-accent/40 bg-elevated p-4 shell:mx-6">
      <p className="text-subhead font-medium text-text">{webhooks ? 'Nouveau secret, affiché une seule fois' : 'Nouvelle clé, affichée une seule fois'}</p>
      <p className="mt-1 text-footnote text-text-secondary">
        {webhooks
          ? 'Colle ces URL dans Radarr et Sonarr (Réglages → Connexions → Webhook). Les anciennes ne marchent plus.'
          : serviceId === 'sorraa'
            ? 'Colle-la dans sorraa (Réglages → OnyxHub) avec l\'adresse d\'OnyxHub, ou clique « Relier sorraa ». L\'ancienne ne marche plus.'
            : 'Onyx utilise encore l\'ancienne, qui ne marche plus : clique « Connecter Onyx » pour lui transmettre celle-ci.'}
      </p>
      {webhooks ? (
        <>
          <CopyRow label="Radarr" value={`${origin}/api/webhooks/radarr?secret=${value}`} />
          <CopyRow label="Sonarr" value={`${origin}/api/webhooks/sonarr?secret=${value}`} />
        </>
      ) : (
        <CopyRow value={value} />
      )}
    </div>
  )
}
