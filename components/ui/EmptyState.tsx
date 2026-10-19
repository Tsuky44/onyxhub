import type { Icon } from '@/lib/icons'

/** Un état vide calme : une icône discrète, une phrase, rien de décoratif. */
export function EmptyState({ icon: IconComponent, title, description }: { icon: Icon; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-panel border border-glass-border bg-surface px-6 py-16 text-center">
      <IconComponent size={32} className="text-text-muted" aria-hidden />
      <h2 className="mt-4 text-headline font-semibold text-text">{title}</h2>
      <p className="mt-1.5 max-w-md text-body text-pretty text-text-secondary">{description}</p>
    </div>
  )
}
