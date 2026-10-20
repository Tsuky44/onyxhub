import 'server-only'
import { NotConfiguredError, request, requestJson, ServiceError } from '../../http'
import { onyxBaseUrl } from './auth'

const SERVICE = 'Onyx'

/**
 * Les réglages d'Onyx qui le relient à OnyxHub, lus et écrits avec le jeton de
 * l'admin connecté : Onyx exige lui-même `manage_settings` (ADR-0009). Les
 * clés gardent leur nom de l'époque de MediaHub (`mediahub_url`), qu'Onyx
 * conserve pour la compatibilité.
 */
export interface OnyxHubLink {
  url: string
  keySet: boolean
  /** Les 4 derniers caractères de la clé enregistrée, précédés de « •••• » (`maskSecret` côté Go). */
  keyHint: string | null
}

export interface OnyxLinkTest {
  ok: boolean
  message: string
}

export interface OnyxSettings {
  hubLink(): Promise<OnyxHubLink>
  pointToHub(url: string, key: string): Promise<void>
  /** Onyx joint OnyxHub avec ce qu'il a enregistré ; `null` si cet Onyx ne sait pas encore le faire. */
  testHub(): Promise<OnyxLinkTest | null>
}

interface PublicSettings {
  mediahub_url?: string
  mediahub_api_key_set?: boolean
  mediahub_api_key_hint?: string
}

export function createOnyxSettings(baseUrl: string, token: string): OnyxSettings {
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  return {
    async hubLink() {
      const settings = await requestJson<PublicSettings>(SERVICE, `${baseUrl}/api/settings`, { headers, timeoutMs: 5_000 })
      return { url: settings.mediahub_url ?? '', keySet: settings.mediahub_api_key_set === true, keyHint: settings.mediahub_api_key_hint || null }
    },
    async pointToHub(url, key) {
      await request(SERVICE, `${baseUrl}/api/settings`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ mediahub_url: url, mediahub_api_key: key }),
        timeoutMs: 10_000,
      })
    },
    async testHub() {
      try {
        // Onyx attend lui-même la réponse d'OnyxHub (10 s au plus) : on lui laisse le temps de conclure.
        return await requestJson<OnyxLinkTest>(SERVICE, `${baseUrl}/api/settings/mediahub/test`, { method: 'POST', headers, body: '{}', timeoutMs: 15_000 })
      } catch (error) {
        if (error instanceof ServiceError && (error.status === 404 || error.status === 405)) return null
        throw error
      }
    },
  }
}

export function getOnyxSettings(token: string): OnyxSettings {
  const baseUrl = onyxBaseUrl()
  if (!baseUrl) throw new NotConfiguredError(SERVICE)
  return createOnyxSettings(baseUrl, token)
}
