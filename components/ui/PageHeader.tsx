import type { ReactNode } from 'react'

/** Le titre d'une page et sa ligne d'explication, plus d'air au-dessus qu'en dessous. */
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-title1 font-bold tracking-[-0.02em] text-balance text-text shell:text-large-title">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-callout text-pretty text-text-secondary">{description}</p>}
      </div>
      {actions}
    </div>
  )
}
