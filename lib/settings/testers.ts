import 'server-only'
import { errorMessage, normalizeBaseUrl, ServiceError } from '../http'
import { createRadarr } from '../services/arr/radarr'
import { createSonarr } from '../services/arr/sonarr'
import { pingOnyx } from '../services/onyx/auth'
import { createProwlarr } from '../services/prowlarr'
import { createQbittorrent } from '../services/qbittorrent/client'
import { createTmdb } from '../services/tmdb/client'
import type { ServiceId } from './registry'

/**
 * Le bouton « Tester » de Réglages : un appel léger par service, avec les
 * valeurs du formulaire (pas forcément enregistrées), à travers les mêmes
 * modules de service que le reste de l'app.
 */
export interface TestResult {
  ok: boolean
  message: string
}

export type Values = Record<string, string | undefined>

function baseUrl(values: Values, key: string, service: string): string {
  const url = normalizeBaseUrl(values[key])
  if (!url) throw new ServiceError(service, `L'URL de ${service} est vide ou invalide`)
  return url
}

function secret(values: Values, key: string, service: string): string {
  const value = values[key]?.trim()
  if (!value) throw new ServiceError(service, `Il manque la clé API de ${service}`)
  return value
}

const responds = (service: string, version: string | null) => (version ? `${service} ${version} répond.` : `${service} répond.`)

function arrConfig(values: Values, prefix: 'radarr' | 'sonarr' | 'prowlarr', service: string) {
  return { baseUrl: baseUrl(values, `${prefix}_url`, service), apiKey: secret(values, `${prefix}_api_key`, service) }
}

const TESTERS: Partial<Record<ServiceId, (values: Values) => Promise<string>>> = {
  onyx: async (values) => responds('Onyx', (await pingOnyx(baseUrl(values, 'onyx_url', 'Onyx'))).version),
  tmdb: async (values) => {
    await createTmdb(secret(values, 'tmdb_api_key', 'TMDB')).check()
    return 'La clé TMDB est acceptée.'
  },
  radarr: async (values) => responds('Radarr', await createRadarr(arrConfig(values, 'radarr', 'Radarr')).version()),
  sonarr: async (values) => responds('Sonarr', await createSonarr(arrConfig(values, 'sonarr', 'Sonarr')).version()),
  prowlarr: async (values) => responds('Prowlarr', await createProwlarr(arrConfig(values, 'prowlarr', 'Prowlarr')).version()),
  qbittorrent: async (values) => {
    const qbit = createQbittorrent(
      {
        baseUrl: baseUrl(values, 'qbittorrent_url', 'qBittorrent'),
        username: values.qbittorrent_username?.trim() ?? '',
        password: values.qbittorrent_password ?? '',
      },
      { isolated: true },
    )
    return responds('qBittorrent', await qbit.version())
  },
}

export async function testService(id: ServiceId, values: Values): Promise<TestResult> {
  const tester = TESTERS[id]
  if (!tester) return { ok: false, message: 'Pas de test pour ce service.' }
  try {
    return { ok: true, message: await tester(values) }
  } catch (error) {
    return { ok: false, message: errorMessage(error) }
  }
}
