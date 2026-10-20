'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { loginAction, type LoginState } from './actions'
import { AppPairing } from './AppPairing'

const INITIAL: LoginState = { step: 'password' }

export function LoginForm({ next, needsServer }: { next: string; needsServer: boolean }) {
  const [state, action, pending] = useActionState(loginAction, INITIAL)

  return (
    <div className="w-full max-w-sm rounded-modal border border-glass-border bg-surface p-6 shell:p-8">
      {state.step === 'recovery' ? (
        <RecoveryCodes codes={state.codes} next={state.next} />
      ) : (
        <form action={action} className="flex flex-col gap-4" noValidate>
          <input type="hidden" name="suite" value={next} />
          {state.step === 'password' ? (
            <>
              <div>
                <h1 className="text-title2 font-bold tracking-[-0.01em] text-text">Connexion</h1>
                <p className="mt-1 text-body text-text-secondary">Avec ton compte Onyx.</p>
              </div>
              {needsServer && (
                <TextField
                  label="Adresse du serveur Onyx"
                  name="server"
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  placeholder="http://192.168.1.10:8080"
                  help="Demandée une seule fois. L'admin pourra la changer dans Réglages."
                  required
                />
              )}
              <TextField label="Nom d'utilisateur" name="username" defaultValue={state.username} autoComplete="username" autoCapitalize="none" spellCheck={false} required />
              <TextField label="Mot de passe" name="password" type="password" autoComplete="current-password" required />
            </>
          ) : (
            <OtpStep setup={state.setup} secret={state.secret} uri={state.uri} />
          )}

          {state.error && (
            <p role="alert" className="rounded-card border border-error/30 bg-error/10 px-3 py-2 text-subhead text-error">
              {state.error}
            </p>
          )}

          <Button type="submit" pending={pending} className="mt-1 w-full">
            {state.step === 'otp' ? 'Valider' : 'Se connecter'}
          </Button>
        </form>
      )}
      {state.step === 'password' && !needsServer && (
        <div className="mt-5 flex flex-col gap-4">
          <p className="flex items-center gap-3 text-footnote text-text-muted before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
            ou
          </p>
          <AppPairing next={next} />
        </div>
      )}
    </div>
  )
}

function OtpStep({ setup, secret, uri }: { setup: boolean; secret?: string; uri?: string }) {
  return (
    <>
      <div>
        <h1 className="text-title2 font-bold tracking-[-0.01em] text-text">Validation en deux étapes</h1>
        <p className="mt-1 text-body text-pretty text-text-secondary">
          {setup
            ? 'Ce serveur l\'exige. Ajoute cette clé dans ton application d\'authentification, puis saisis le code affiché.'
            : 'Saisis le code de ton application d\'authentification, ou un code de secours.'}
        </p>
      </div>
      {setup && secret && (
        <div className="rounded-card border border-border bg-elevated p-3">
          <p className="text-footnote text-text-muted">Clé à ajouter</p>
          <p className="mt-1 font-mono text-subhead break-all text-text select-all">{secret}</p>
          {uri && (
            <a href={uri} className="mt-2 inline-block text-subhead font-medium text-accent hover:text-accent-muted">
              Ouvrir dans l&apos;application d&apos;authentification
            </a>
          )}
        </div>
      )}
      <TextField
        label="Code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        maxLength={32}
        className="[&_input]:font-mono [&_input]:tracking-[0.3em]"
        required
      />
    </>
  )
}

function RecoveryCodes({ codes, next }: { codes: string[]; next: string }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-title2 font-bold tracking-[-0.01em] text-text">Codes de secours</h1>
        <p className="mt-1 text-body text-pretty text-text-secondary">
          Garde-les en lieu sûr : chacun remplace une fois le code de l&apos;application si tu perds ton téléphone. Ils ne
          seront plus affichés.
        </p>
      </div>
      <ul className="grid grid-cols-2 gap-2 rounded-card border border-border bg-elevated p-3 font-mono text-subhead text-text">
        {codes.map((code) => (
          <li key={code} className="select-all">
            {code}
          </li>
        ))}
      </ul>
      <a
        href={next}
        className="inline-flex min-h-11 items-center justify-center rounded-card bg-primary-fill px-4 text-subhead font-semibold text-on-primary transition-colors duration-(--motion-micro) ease-onyx hover:bg-text"
      >
        Je les ai notés, continuer
      </a>
    </div>
  )
}
