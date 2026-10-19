import 'server-only'
import { NotConfiguredError, ServiceError } from '../http'
import { getProwlarr, type ProwlarrRelease } from '../services/prowlarr'
import { getQbittorrent, qbittorrentConfig } from '../services/qbittorrent/client'
import { qbitLive } from '../services/qbittorrent/live'
import { TtlCache } from '../ttl-cache'

/**
 * La recherche Prowlarr de Téléchargements. Les liens de téléchargement
 * restent sur le serveur : ceux de Prowlarr contiennent sa clé API, et
 * MediaHub les envoyait au navigateur. Le client ne connaît que le `guid` ;
 * l'envoi retrouve le lien dans ce cache.
 */
export const RESULTS_PER_PAGE = 100

export const SEARCH_CATEGORIES = [
  { id: 2000, label: 'Films' },
  { id: 5000, label: 'Séries' },
  { id: 3000, label: 'Musique' },
  { id: 7000, label: 'Livres' },
  { id: 4000, label: 'PC / jeux' },
] as const

export interface ReleaseWire {
  guid: string
  indexerId: number
  indexer: string
  title: string
  size: number
  seeders: number | null
  leechers: number | null
  grabs: number | null
  publishDate: string
  protocol: string
  /** La page de la release chez l'indexeur, quand il en donne une. */
  infoUrl: string | null
  categories: string[]
}

const sent = new TtlCache<ProwlarrRelease>(60 * 60_000, 5_000)

function toWire(release: ProwlarrRelease): ReleaseWire {
  return {
    guid: release.guid,
    indexerId: release.indexerId,
    indexer: release.indexer,
    title: release.title,
    size: release.size,
    seeders: release.seeders ?? null,
    leechers: release.leechers ?? null,
    grabs: release.grabs ?? null,
    publishDate: release.publishDate,
    protocol: release.protocol,
    infoUrl: release.infoUrl && /^https?:\/\//i.test(release.infoUrl) ? release.infoUrl : null,
    categories: [...new Set((release.categories ?? []).map((category) => category.name).filter(Boolean))],
  }
}

export async function searchReleases(input: { query: string; categories: number[]; indexerIds: number[]; offset: number }): Promise<{ releases: ReleaseWire[]; more: boolean }> {
  const releases = await getProwlarr().search({
    query: input.query,
    categories: input.categories.length > 0 ? input.categories : undefined,
    indexerIds: input.indexerIds.length > 0 ? input.indexerIds : undefined,
    limit: RESULTS_PER_PAGE,
    offset: input.offset,
  })
  for (const release of releases) sent.set(release.guid, release)
  return { releases: releases.map(toWire), more: releases.length >= RESULTS_PER_PAGE }
}

/**
 * Envoie une release vers qBittorrent (lien magnet ou .torrent servi par
 * Prowlarr), comme MediaHub. Sans qBit configuré, Prowlarr l'envoie à son
 * propre client de téléchargement.
 */
export async function sendRelease(guid: string): Promise<'qbittorrent' | 'prowlarr'> {
  const release = sent.get(guid)
  if (!release) throw new ServiceError('Prowlarr', 'Résultat expiré : relance la recherche.')
  if (release.protocol !== 'torrent') throw new ServiceError('Prowlarr', 'Seules les releases torrent peuvent partir vers qBittorrent.')
  const url = release.magnetUrl || release.downloadUrl
  if (qbittorrentConfig() && url) {
    await getQbittorrent().add({ urls: [url] })
    void qbitLive().refresh()
    return 'qbittorrent'
  }
  try {
    await getProwlarr().grab(release)
    return 'prowlarr'
  } catch (error) {
    if (error instanceof NotConfiguredError) throw new NotConfiguredError('qBittorrent')
    throw error
  }
}
