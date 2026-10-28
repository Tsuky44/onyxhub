import 'server-only'
import { eachLimited } from '../concurrency'
import { errorMessage } from '../http'
import type { DownloadTarget } from './download-targets'
import { combineDownloads, mediaDownloads, type DownloadProgress } from './downloads'

export interface GroupDownloads {
  /** Par clé de lot, seulement ceux qui téléchargent. */
  downloads: Record<string, DownloadProgress>
  /** L'âge de la plus vieille mesure, en millisecondes. */
  age: number
}

/**
 * La barre de chaque lot de la liste ou de l'accueil. Avec sorraa, tout vient
 * de son dernier rapport, gardé en mémoire : aucun appel réseau. Sans lui,
 * l'index de bibliothèque et l'état de qBit sont partagés et en cache.
 */
export async function downloadsOf(targets: readonly DownloadTarget[]): Promise<GroupDownloads> {
  const downloads: Record<string, DownloadProgress> = {}
  let age = 0
  await eachLimited([...targets], 4, async (target) => {
    try {
      const snapshot = await mediaDownloads(target.mediaType, target.tmdbId)
      const combined = combineDownloads(snapshot.items, target.seasons, '')
      if (!combined) return
      downloads[target.key] = combined
      age = Math.max(age, snapshot.age)
    } catch (error) {
      // La barre est un bonus : sans elle, la ligne garde son statut.
      console.warn(`[demandes] téléchargement ${target.mediaType}/${target.tmdbId} : ${errorMessage(error)}`)
    }
  })
  return { downloads, age }
}
