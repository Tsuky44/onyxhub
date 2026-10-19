'use server'

import { revalidatePath } from 'next/cache'
import { getViewer } from '@/lib/auth/viewer'
import { errorMessage } from '@/lib/http'
import { loadRequestPage, parseListFilters, type RequestListPage } from '@/lib/requests/list'
import { removeRequests } from '@/lib/requests/remove'
import { importFromArr, refreshStatuses } from '@/lib/requests/sync'

/** Les actions de la liste des demandes. Supprimer et synchroniser sont réservés à l'admin, comme dans MediaHub. */

export async function loadRequestPageAction(search: string, offset: number): Promise<RequestListPage> {
  const viewer = await getViewer()
  const safeOffset = Number.isInteger(offset) && offset >= 0 ? offset : 0
  return loadRequestPage(parseListFilters(new URLSearchParams(typeof search === 'string' ? search : ''), viewer.name), safeOffset)
}

export async function deleteRequestsAction(ids: number[]): Promise<{ ok: boolean; message: string }> {
  const viewer = await getViewer()
  if (!viewer.isAdmin) return { ok: false, message: 'Réservé aux administrateurs.' }
  const clean = Array.isArray(ids) ? ids.filter((id) => Number.isInteger(id) && id > 0).slice(0, 500) : []
  if (clean.length === 0) return { ok: false, message: 'Aucune demande choisie.' }
  try {
    const report = await removeRequests(clean)
    revalidatePath('/demandes', 'layout')
    const done = report.deleted > 1 ? `${report.deleted} demandes supprimées.` : 'Demande supprimée.'
    return { ok: true, message: report.warnings.length > 0 ? `${done} À vérifier : ${report.warnings.join(' ')}` : done }
  } catch (error) {
    return { ok: false, message: errorMessage(error) }
  }
}

export async function syncRequestsAction(): Promise<{ ok: boolean; message: string }> {
  const viewer = await getViewer()
  if (!viewer.isAdmin) return { ok: false, message: 'Réservé aux administrateurs.' }
  try {
    const report = await importFromArr()
    revalidatePath('/demandes', 'layout')
    const parts = [
      report.imported > 0 ? `${report.imported} demande(s) importée(s) depuis Radarr/Sonarr` : 'Rien de nouveau à importer',
      report.updated > 0 ? `${report.updated} statut(s) mis à jour` : null,
    ].filter(Boolean)
    return { ok: report.warnings.length === 0, message: `${parts.join(', ')}.${report.warnings.length > 0 ? ` ${report.warnings.join(' ')}` : ''}` }
  } catch (error) {
    return { ok: false, message: errorMessage(error) }
  }
}

export async function refreshStatusesAction(): Promise<{ ok: boolean; message: string }> {
  await getViewer()
  try {
    const changed = await refreshStatuses()
    revalidatePath('/demandes/liste')
    return { ok: true, message: changed > 0 ? `${changed} statut(s) mis à jour.` : 'Les statuts sont à jour.' }
  } catch (error) {
    return { ok: false, message: errorMessage(error) }
  }
}
