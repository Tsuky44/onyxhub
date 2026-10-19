import 'server-only'
import { errorMessage, normalizeBaseUrl, request, requestJson, ServiceError } from '../http'
import { pingOnyx } from '../services/onyx/auth'
import type { ServiceId } from './registry'

/**
 * Le bouton « Tester » de Réglages : un appel léger par service, avec les
 * valeurs du formulaire (pas forcément enregistrées). La phase 2 déplacera ces
 * appels dans les modules de service ; le contrat reste « valeurs → verdict ».
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

function secret(values: Values, key: string, service: string, label = 'la clé API'): string {
  const value = values[key]?.trim()
  if (!value) throw new ServiceError(service, `Il manque ${label} de ${service}`)
  return value
}

async function arrStatus(service: string, url: string, apiKey: string, version: 'v1' | 'v3'): Promise<string> {
  const status = await requestJson<{ version?: string }>(service, `${url}/api/${version}/system/status`, {
    headers: { 'X-Api-Key': apiKey },
  })
  return status.version ? `${service} ${status.version} répond.` : `${service} répond.`
}

/**
 * Une clé TMDB v3 est une chaîne de 32 caractères passée en paramètre ; un
 * jeton v4 est un JWT bien plus long, passé en `Authorization`. MediaHub
 * n'acceptait que la v3.
 */
export function tmdbAuth(key: string): { query: string; headers: Record<string, string> } {
  return key.length > 40
    ? { query: '', headers: { Authorization: `Bearer ${key}` } }
    : { query: `?api_key=${encodeURIComponent(key)}`, headers: {} }
}

async function qbittorrentVersion(url: string, username: string, password: string): Promise<string> {
  // qBittorrent refuse un login sans `Referer` du même hôte (protection CSRF).
  const login = await request('qBittorrent', `${url}/api/v2/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Referer: url },
    body: new URLSearchParams({ username, password }),
  })
  const verdict = (await login.text()).trim()
  if (verdict !== 'Ok.') throw new ServiceError('qBittorrent', 'qBittorrent : identifiants refusés')
  // Pas de cookie si qBit dispense d'authentification ce réseau : l'appel suivant passe sans.
  const sid = login.headers.get('set-cookie')?.match(/SID=[^;]+/)?.[0]
  const version = await request('qBittorrent', `${url}/api/v2/app/version`, { headers: sid ? { Cookie: sid } : {} })
  return `qBittorrent ${(await version.text()).trim()} répond.`
}

const TESTERS: Partial<Record<ServiceId, (values: Values) => Promise<string>>> = {
  onyx: async (values) => `Onyx ${(await pingOnyx(baseUrl(values, 'onyx_url', 'Onyx'))).version} répond.`,
  tmdb: async (values) => {
    const auth = tmdbAuth(secret(values, 'tmdb_api_key', 'TMDB'))
    await request('TMDB', `https://api.themoviedb.org/3/configuration${auth.query}`, { headers: auth.headers })
    return 'La clé TMDB est acceptée.'
  },
  radarr: (values) => arrStatus('Radarr', baseUrl(values, 'radarr_url', 'Radarr'), secret(values, 'radarr_api_key', 'Radarr'), 'v3'),
  sonarr: (values) => arrStatus('Sonarr', baseUrl(values, 'sonarr_url', 'Sonarr'), secret(values, 'sonarr_api_key', 'Sonarr'), 'v3'),
  prowlarr: (values) =>
    arrStatus('Prowlarr', baseUrl(values, 'prowlarr_url', 'Prowlarr'), secret(values, 'prowlarr_api_key', 'Prowlarr'), 'v1'),
  qbittorrent: (values) =>
    qbittorrentVersion(
      baseUrl(values, 'qbittorrent_url', 'qBittorrent'),
      values.qbittorrent_username?.trim() ?? '',
      values.qbittorrent_password ?? '',
    ),
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
