import 'server-only'
import { randomToken } from '../crypto'
import { errorMessage, normalizeBaseUrl } from '../http'
import { getOnyxSettings, type OnyxHubLink } from '../services/onyx/settings'
import { getSetting, setSettings } from '../settings/store'

/**
 * La liaison Onyx → OnyxHub (ADR-0009). Onyx appelle OnyxHub avec l'adresse
 * et la clé enregistrées dans *ses* réglages ; avant, l'admin devait les y
 * recopier à la main. « Connecter Onyx » les y écrit avec le jeton de l'admin,
 * puis demande à Onyx de joindre OnyxHub : seul ce test, fait depuis le
 * réseau d'Onyx, prouve que l'adresse est la bonne.
 */
export type LinkState =
  | { kind: 'linked'; onyxUrl: string }
  | { kind: 'elsewhere'; onyxUrl: string }
  | { kind: 'stale-key'; onyxUrl: string }
  | { kind: 'not-set' }
  | { kind: 'unknown'; message: string }

/**
 * Compare ce qu'Onyx a enregistré à ce qu'OnyxHub attend. Onyx ne rend de sa
 * clé que les 4 derniers caractères : c'est assez pour reconnaître la nôtre
 * parmi des clés aléatoires. L'adresse ne compte que si l'admin l'a fixée :
 * l'origine du navigateur (une IP, un domaine) peut légitimement différer de
 * celle qu'Onyx utilise (un nom Docker).
 */
export function compareLink(onyx: OnyxHubLink, key: string | undefined, explicitHubUrl: string | null): LinkState {
  const onyxUrl = normalizeBaseUrl(onyx.url)
  if (!onyxUrl) return { kind: 'not-set' }
  const sameKey = Boolean(key && key.length >= 4 && onyx.keySet && onyx.keyHint?.endsWith(key.slice(-4)))
  if (!sameKey) return { kind: 'stale-key', onyxUrl }
  if (explicitHubUrl && explicitHubUrl !== onyxUrl) return { kind: 'elsewhere', onyxUrl }
  return { kind: 'linked', onyxUrl }
}

/** La ligne d'état de la carte « Liaison avec Onyx ». */
export function describeLink(state: LinkState): { good: boolean; text: string } {
  switch (state.kind) {
    case 'linked':
      // Les réglages d'Onyx concordent ; seul « Connecter Onyx » prouve qu'il joint vraiment cette adresse.
      return { good: true, text: `Onyx est réglé sur ${state.onyxUrl} avec la bonne clé.` }
    case 'elsewhere':
      return { good: false, text: `Onyx utilise l'adresse ${state.onyxUrl}, pas celle fixée ici : reconnecte-le.` }
    case 'stale-key':
      return { good: false, text: `Onyx pointe vers ${state.onyxUrl} avec une autre clé : reconnecte-le.` }
    case 'not-set':
      return { good: false, text: 'Onyx n\'est pas encore relié à OnyxHub.' }
    case 'unknown':
      return { good: false, text: `État de la liaison inconnu. ${state.message}` }
  }
}

function explicitHubUrl(): string | null {
  return normalizeBaseUrl(getSetting('onyxhub_url'))
}

export async function readLinkState(token: string): Promise<LinkState> {
  try {
    const onyx = await getOnyxSettings(token).hubLink()
    return compareLink(onyx, getSetting('integration_api_key'), explicitHubUrl())
  } catch (error) {
    return { kind: 'unknown', message: errorMessage(error) }
  }
}

export interface LinkOutcome {
  ok: boolean
  message: string
}

/** Écrit l'adresse d'OnyxHub et la clé dans Onyx (en créant la clé s'il n'y en a pas), puis fait vérifier la liaison par Onyx. */
export async function linkOnyx(token: string, browserOrigin: string | null): Promise<LinkOutcome> {
  const hubUrl = explicitHubUrl() ?? normalizeBaseUrl(browserOrigin)
  if (!hubUrl) return { ok: false, message: "Renseigne l'adresse d'OnyxHub telle qu'Onyx la voit." }

  let key = getSetting('integration_api_key')
  if (!key) {
    key = randomToken()
    setSettings({ integration_api_key: key })
  }

  const onyx = getOnyxSettings(token)
  try {
    await onyx.pointToHub(hubUrl, key)
  } catch (error) {
    return { ok: false, message: `Onyx n'a pas enregistré la liaison. ${errorMessage(error)}` }
  }

  let test
  try {
    test = await onyx.testHub()
  } catch (error) {
    return { ok: false, message: `Onyx est réglé sur ${hubUrl}, mais la vérification a échoué. ${errorMessage(error)}` }
  }
  if (!test) {
    return { ok: true, message: `Onyx est réglé sur ${hubUrl}. Cette version d'Onyx ne sait pas vérifier la liaison : fais une demande depuis l'app pour t'en assurer.` }
  }
  if (!test.ok) {
    return {
      ok: false,
      message: `Onyx est réglé sur ${hubUrl}, mais ne joint pas OnyxHub (${test.message.replace(/\.$/, '')}). Renseigne l'adresse d'OnyxHub telle qu'Onyx la voit, puis reconnecte.`,
    }
  }
  return { ok: true, message: `Onyx joint OnyxHub à ${hubUrl}.` }
}
