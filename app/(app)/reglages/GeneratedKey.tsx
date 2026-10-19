'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { CopyIcon } from '@/lib/icons'

/** La clé d'intégration qu'on vient de générer, montrée une seule fois, à copier dans Onyx. */
export function GeneratedKey({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="mx-5 mb-5 rounded-card border border-accent/40 bg-elevated p-4 shell:mx-6">
      <p className="text-subhead font-medium text-text">Nouvelle clé, affichée une seule fois</p>
      <p className="mt-1 text-footnote text-text-secondary">Colle-la dans Onyx, champ « Clé API MediaHub ». L&apos;ancienne clé ne marche plus.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 rounded-card bg-bg px-3 py-2 font-mono text-subhead break-all text-text select-all">{value}</code>
        <Button
          variant="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value)
              setCopied(true)
            } catch {
              // Presse-papiers refusé (HTTP hors localhost) : la clé reste sélectionnable à la main.
              setCopied(false)
            }
          }}
        >
          <CopyIcon size={16} aria-hidden />
          {copied ? 'Copiée' : 'Copier'}
        </Button>
      </div>
    </div>
  )
}
