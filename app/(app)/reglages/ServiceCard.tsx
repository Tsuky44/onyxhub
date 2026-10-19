'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { cn } from '@/lib/cn'
import { SuccessIcon, WarningIcon } from '@/lib/icons'
import { findService, type ServiceId } from '@/lib/settings/registry'
import { serviceStatus } from '@/lib/settings/status'
import type { FieldSnapshot } from '@/lib/settings/store'
import { serviceAction, type ServiceFormState } from './actions'
import { GeneratedKey } from './GeneratedKey'
import { StatusPill } from './StatusPill'

const IDLE: ServiceFormState = { kind: 'idle' }

function initialValues(snapshots: FieldSnapshot[]): Record<string, string> {
  return Object.fromEntries(snapshots.map((field) => [field.key, field.value]))
}

/**
 * Une carte par service. Les champs sont contrôlés : React vide un formulaire
 * non contrôlé après chaque action, et « Tester » effacerait alors ce qu'on
 * vient de saisir avant d'avoir pu l'enregistrer.
 */
export function ServiceCard({ serviceId, snapshots }: { serviceId: ServiceId; snapshots: FieldSnapshot[] }) {
  const service = findService(serviceId)
  const [values, setValues] = useState(() => initialValues(snapshots))
  const [state, formAction, pending] = useActionState(async (previous: ServiceFormState, form: FormData) => {
    const result = await serviceAction(serviceId, previous, form)
    // Un secret enregistré ne se réaffiche pas : le champ redevient vide, avec « enregistrée » à côté.
    if (result.kind === 'saved') {
      setValues((current) =>
        Object.fromEntries(
          Object.entries(current).map(([key, value]) => {
            const secret = service?.fields.find((field) => field.key === key)?.kind === 'secret'
            return [key, result.cleared || secret ? '' : value]
          }),
        ),
      )
    }
    return result
  }, IDLE)

  if (!service) return null
  const byKey = new Map(snapshots.map((field) => [field.key, field]))
  const status = serviceStatus(service, (key) => Boolean(byKey.get(key)?.isSet))
  const errors = state.kind === 'invalid' ? state.errors : {}

  return (
    <section aria-labelledby={`service-${service.id}`} className="rounded-panel border border-glass-border bg-surface">
      <form action={formAction} noValidate autoComplete="off">
        <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 shell:px-6 shell:pt-6">
          <div className="min-w-0">
            <h2 id={`service-${service.id}`} className="text-headline font-semibold text-text">
              {service.label}
            </h2>
            <p className="mt-1 max-w-xl text-subhead text-pretty text-text-secondary">{service.description}</p>
          </div>
          <StatusPill status={status} />
        </header>

        <div className="grid gap-4 px-5 py-5 shell:grid-cols-2 shell:px-6">
          {service.fields.map((field) => {
            const snapshot = byKey.get(field.key)
            const secret = field.kind === 'secret'
            return (
              <TextField
                key={field.key}
                name={field.key}
                label={field.optional ? `${field.label} (facultatif)` : field.label}
                type={secret ? 'password' : field.kind === 'number' ? 'number' : field.kind === 'url' ? 'url' : 'text'}
                inputMode={field.kind === 'number' ? 'numeric' : field.kind === 'url' ? 'url' : undefined}
                // `new-password` : sans ça, le navigateur colle le mot de passe Onyx de l'admin dans le champ qBit.
                autoComplete={secret ? 'new-password' : 'off'}
                spellCheck={false}
                min={field.min}
                max={field.max}
                value={snapshot?.lockedBy ? snapshot.value : (values[field.key] ?? '')}
                onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                disabled={Boolean(snapshot?.lockedBy)}
                placeholder={secret && snapshot?.isSet ? '•••••••• (laisser vide pour garder)' : (field.placeholder ?? field.fallback)}
                help={snapshot?.lockedBy ? `Fixé par la variable ${snapshot.lockedBy}.` : field.help}
                error={errors[field.key]}
                aside={
                  secret && snapshot?.isSet ? (
                    <span className="font-mono text-micro tracking-wider text-success">ENREGISTRÉE</span>
                  ) : undefined
                }
                className={field.kind === 'url' && service.fields.length > 1 ? 'shell:col-span-2' : undefined}
              />
            )
          })}
        </div>

        {state.kind === 'generated' && <GeneratedKey serviceId={serviceId} value={state.key} />}

        <footer className="flex flex-wrap items-center gap-3 border-t border-glass-border px-5 py-4 shell:px-6">
          <Feedback state={state} />
          {/*
            Ordre inversé dans le DOM : la touche Entrée déclenche le premier
            bouton d'envoi du formulaire, qui doit être « Enregistrer » et pas
            « Retirer ». L'ordre visuel reste Retirer · Tester · Enregistrer.
          */}
          <div className="ml-auto flex flex-row-reverse flex-wrap gap-2">
            <Button type="submit" name="intent" value="save" pending={pending}>
              Enregistrer
            </Button>
            {service.testable && (
              <Button type="submit" name="intent" value="test" variant="secondary" disabled={pending}>
                Tester
              </Button>
            )}
            {service.generates && (
              <Button type="submit" name="intent" value="generate" variant="secondary" disabled={pending}>
                {service.id === 'webhooks' ? 'Générer un secret' : 'Générer une clé'}
              </Button>
            )}
            {service.id !== 'onyx' && status !== 'empty' && (
              <Button
                type="submit"
                name="intent"
                value="clear"
                variant="ghost"
                disabled={pending}
                onClick={(event) => {
                  if (!window.confirm(`Retirer les réglages de ${service.label} ?`)) event.preventDefault()
                }}
              >
                Retirer
              </Button>
            )}
          </div>
        </footer>
      </form>
    </section>
  )
}

function Feedback({ state }: { state: ServiceFormState }) {
  if (state.kind === 'idle' || state.kind === 'generated') return <span />
  const good = state.kind === 'saved' || (state.kind === 'tested' && state.ok)
  const message = state.kind === 'invalid' ? 'Corrige les champs signalés.' : state.message
  const Icon = good ? SuccessIcon : WarningIcon
  return (
    <p role="status" className={cn('flex min-w-0 items-center gap-1.5 text-subhead', good ? 'text-success' : 'text-error')}>
      <Icon size={18} weight="fill" aria-hidden className="shrink-0" />
      <span className="min-w-0">{message}</span>
    </p>
  )
}
