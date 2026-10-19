'use client'

import { useId, useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Dialog } from '@/components/ui/Dialog'
import { TextField } from '@/components/ui/TextField'
import { cn } from '@/lib/cn'
import { COLUMN_OPTIONS, DEFAULT_FILTERS, type ColumnId, type TorrentFilters } from '@/lib/downloads/torrents'
import { addTorrentsAction, deleteTorrentsAction, shareLimitsAction, type ActionResult } from '../actions'

export const fieldClass =
  'min-h-11 w-full rounded-card border border-border bg-elevated px-3.5 text-body text-text placeholder:text-text-muted outline-none transition-colors duration-(--motion-micro) ease-onyx hover:border-text-muted focus:border-accent'

function Feedback({ result }: { result: ActionResult | null }) {
  if (!result || result.ok) return null
  return (
    <p role="alert" className="rounded-card border border-error/30 bg-error/10 px-3 py-2 text-subhead text-error">
      {result.message}
    </p>
  )
}

/** Liens magnet ou URL (un par ligne) et fichiers .torrent, avec catégorie, tags et démarrage en pause. */
export function AddTorrentDialog({ open, onClose, categories, onDone }: { open: boolean; onClose: () => void; categories: string[]; onDone: (result: ActionResult) => void }) {
  const [result, setResult] = useState<ActionResult | null>(null)
  const [pending, startTransition] = useTransition()
  const linksId = useId()
  const filesId = useId()
  const categoryId = useId()
  const formId = useId()

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Ajouter des torrents"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form={formId} pending={pending}>
            Ajouter
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className="flex flex-col gap-4"
        action={(form) =>
          startTransition(async () => {
            const outcome = await addTorrentsAction(form)
            setResult(outcome)
            if (outcome.ok) onDone(outcome)
          })
        }
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor={linksId} className="text-footnote font-medium text-text-secondary">
            Liens magnet ou URL
          </label>
          <textarea
            id={linksId}
            name="liens"
            rows={4}
            placeholder="magnet:?xt=urn:btih:…"
            spellCheck={false}
            className={cn(fieldClass, 'min-h-28 py-2.5 font-mono text-footnote')}
          />
          <p className="text-footnote text-text-muted">Un lien par ligne.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={filesId} className="text-footnote font-medium text-text-secondary">
            Fichiers .torrent
          </label>
          <input
            id={filesId}
            name="fichiers"
            type="file"
            accept=".torrent,application/x-bittorrent"
            multiple
            className="text-subhead text-text-secondary file:mr-3 file:min-h-11 file:rounded-card file:border file:border-glass-border file:bg-glass-fill file:px-3 file:text-subhead file:font-semibold file:text-text"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={categoryId} className="text-footnote font-medium text-text-secondary">
              Catégorie
            </label>
            <select id={categoryId} name="categorie" defaultValue="" className={fieldClass}>
              <option value="">Aucune</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <TextField label="Tags" name="tags" placeholder="séparés par des virgules" />
        </div>
        <label className="flex min-h-11 items-center gap-3 text-subhead text-text">
          <input type="checkbox" name="pause" className="size-5 accent-accent" />
          Ajouter en pause
        </label>
        <Feedback result={result} />
      </form>
    </Dialog>
  )
}

/** Confirmation de suppression, avec ou sans les fichiers (décoché par défaut : on ne perd rien par mégarde). */
export function DeleteDialog({ hashes, names, onClose, onDone }: { hashes: string[]; names: string[]; onClose: () => void; onDone: (result: ActionResult) => void }) {
  const [deleteFiles, setDeleteFiles] = useState(false)
  const [result, setResult] = useState<ActionResult | null>(null)
  const [pending, startTransition] = useTransition()
  const many = hashes.length > 1
  return (
    <Dialog
      open={hashes.length > 0}
      onClose={onClose}
      title={many ? `Supprimer ${hashes.length} torrents ?` : 'Supprimer ce torrent ?'}
      description={many ? undefined : <span className="break-all">{names[0]}</span>}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant="danger"
            pending={pending}
            onClick={() =>
              startTransition(async () => {
                const outcome = await deleteTorrentsAction(hashes, deleteFiles)
                setResult(outcome)
                if (outcome.ok) onDone(outcome)
              })
            }
          >
            Supprimer
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex min-h-11 items-center gap-3 text-subhead text-text">
          <input type="checkbox" checked={deleteFiles} onChange={(event) => setDeleteFiles(event.target.checked)} className="size-5 accent-error" />
          Supprimer aussi les fichiers du disque
        </label>
        {deleteFiles && <p className="text-footnote text-warning">Les fichiers seront effacés définitivement, y compris ceux déjà importés par Radarr ou Sonarr s’ils sont liés en dur.</p>}
        <Feedback result={result} />
      </div>
    </Dialog>
  )
}

type LimitMode = 'global' | 'none' | 'custom'
const UNITS = [
  { id: 'minutes', label: 'minutes', minutes: 1 },
  { id: 'heures', label: 'heures', minutes: 60 },
  { id: 'jours', label: 'jours', minutes: 1_440 },
  { id: 'semaines', label: 'semaines', minutes: 10_080 },
] as const

function ModeChips({ value, onChange, label }: { value: LimitMode; onChange: (mode: LimitMode) => void; label: string }) {
  const modes: { id: LimitMode; label: string }[] = [
    { id: 'global', label: 'Réglage global' },
    { id: 'none', label: 'Aucune' },
    { id: 'custom', label: 'Personnalisée' },
  ]
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {modes.map((mode) => (
        <Chip key={mode.id} pressed={value === mode.id} onClick={() => onChange(mode.id)}>
          {mode.label}
        </Chip>
      ))}
    </div>
  )
}

/** Limites de partage : ratio et durée de partage, chacun au réglage global, sans limite ou personnalisé. */
export function ShareLimitsDialog({ hashes, onClose, onDone }: { hashes: string[]; onClose: () => void; onDone: (result: ActionResult) => void }) {
  const [ratioMode, setRatioMode] = useState<LimitMode>('global')
  const [ratio, setRatio] = useState('2')
  const [timeMode, setTimeMode] = useState<LimitMode>('global')
  const [time, setTime] = useState('7')
  const [unit, setUnit] = useState<(typeof UNITS)[number]['id']>('jours')
  const [result, setResult] = useState<ActionResult | null>(null)
  const [pending, startTransition] = useTransition()
  const unitId = useId()

  const apply = () => {
    const toLimit = (mode: LimitMode, value: number) => (mode === 'global' ? -2 : mode === 'none' ? -1 : value)
    const minutes = Number.parseFloat(time.replace(',', '.')) * (UNITS.find((entry) => entry.id === unit)?.minutes ?? 1)
    const ratioValue = Number.parseFloat(ratio.replace(',', '.'))
    if ((ratioMode === 'custom' && !(ratioValue >= 0)) || (timeMode === 'custom' && !(minutes >= 0))) {
      setResult({ ok: false, message: 'Saisis des valeurs positives.' })
      return
    }
    startTransition(async () => {
      const outcome = await shareLimitsAction(hashes, { ratio: toLimit(ratioMode, ratioValue), seedingMinutes: toLimit(timeMode, minutes) })
      setResult(outcome)
      if (outcome.ok) onDone(outcome)
    })
  }

  return (
    <Dialog
      open={hashes.length > 0}
      onClose={onClose}
      title="Limites de partage"
      description={`Pour ${hashes.length > 1 ? `${hashes.length} torrents` : 'ce torrent'} : au-delà, qBittorrent applique l’action de son réglage global (pause ou suppression).`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button pending={pending} onClick={apply}>
            Appliquer
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-footnote font-medium text-text-secondary">Ratio</legend>
          <ModeChips value={ratioMode} onChange={setRatioMode} label="Limite de ratio" />
          {ratioMode === 'custom' && <TextField label="Ratio maximal" type="number" min={0} step={0.1} value={ratio} onChange={(event) => setRatio(event.target.value)} />}
        </fieldset>
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-footnote font-medium text-text-secondary">Durée de partage</legend>
          <ModeChips value={timeMode} onChange={setTimeMode} label="Limite de durée" />
          {timeMode === 'custom' && (
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Durée" type="number" min={0} value={time} onChange={(event) => setTime(event.target.value)} />
              <div className="flex flex-col gap-1.5">
                <label htmlFor={unitId} className="text-footnote font-medium text-text-secondary">
                  Unité
                </label>
                <select id={unitId} value={unit} onChange={(event) => setUnit(event.target.value as typeof unit)} className={fieldClass}>
                  {UNITS.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </fieldset>
        <Feedback result={result} />
      </div>
    </Dialog>
  )
}

function ChipGroup({ label, options, selected, onChange, render = (value) => value }: { label: string; options: string[]; selected: string[]; onChange: (values: string[]) => void; render?: (value: string) => string }) {
  if (options.length === 0) return null
  return (
    <fieldset>
      <legend className="mb-2 text-footnote font-medium text-text-secondary">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const pressed = selected.includes(option)
          return (
            <Chip key={option || '∅'} pressed={pressed} onClick={() => onChange(pressed ? selected.filter((value) => value !== option) : [...selected, option])}>
              {render(option)}
            </Chip>
          )
        })}
      </div>
    </fieldset>
  )
}

/** Catégories, tags, trackers et date d'ajout. Les choix s'appliquent en direct. */
export function FiltersDialog({
  open,
  onClose,
  filters,
  onChange,
  categories,
  tags,
  trackers,
}: {
  open: boolean
  onClose: () => void
  filters: TorrentFilters
  onChange: (filters: TorrentFilters) => void
  categories: string[]
  tags: string[]
  trackers: string[]
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Filtres"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={() => onChange({ ...DEFAULT_FILTERS, status: filters.status, search: filters.search })}>
            Tout effacer
          </Button>
          <Button onClick={onClose}>Terminé</Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <ChipGroup
          label="Catégories"
          options={['', ...categories]}
          selected={filters.categories}
          onChange={(values) => onChange({ ...filters, categories: values })}
          render={(value) => value || 'Sans catégorie'}
        />
        <ChipGroup label="Tags (tous requis)" options={tags} selected={filters.tags} onChange={(values) => onChange({ ...filters, tags: values })} />
        <ChipGroup label="Trackers" options={trackers} selected={filters.trackers} onChange={(values) => onChange({ ...filters, trackers: values })} />
        <TextField label="Ajoutés depuis le" type="date" value={filters.addedSince} onChange={(event) => onChange({ ...filters, addedSince: event.target.value })} className="max-w-56" />
      </div>
    </Dialog>
  )
}

export function ColumnsDialog({ open, onClose, columns, onChange }: { open: boolean; onClose: () => void; columns: ReadonlySet<ColumnId>; onChange: (columns: ColumnId[]) => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Informations affichées" size="sm" footer={<Button onClick={onClose}>Terminé</Button>}>
      <ul className="grid gap-1 sm:grid-cols-2">
        {COLUMN_OPTIONS.map((column) => (
          <li key={column.id}>
            <label className="flex min-h-11 items-center gap-3 text-subhead text-text">
              <input
                type="checkbox"
                checked={columns.has(column.id)}
                onChange={(event) =>
                  onChange(COLUMN_OPTIONS.map((option) => option.id).filter((id) => (id === column.id ? event.target.checked : columns.has(id))))
                }
                className="size-5 accent-accent"
              />
              {column.label}
            </label>
          </li>
        ))}
      </ul>
    </Dialog>
  )
}
