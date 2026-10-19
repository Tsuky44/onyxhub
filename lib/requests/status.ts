/**
 * Le vocabulaire des statuts, lisible côté client. Deux familles :
 *
 * - le statut d'une **demande** (ligne de la base), qui avance de « en attente »
 *   à « disponible », les cinq statuts de MediaHub ;
 * - la **disponibilité** d'un média dans Radarr/Sonarr, qui s'affiche sur les
 *   cartes et que le serveur Onyx lit par `GET /api/media/availability/:id`.
 *   Ses valeurs sont celles de MediaHub, que l'app Onyx connaît.
 */
export const REQUEST_STATUSES = ['pending', 'approved', 'processing', 'partial', 'available'] as const
export type RequestStatus = (typeof REQUEST_STATUSES)[number]

export type AvailabilityStatus = 'unknown' | 'pending' | 'processing' | 'partial' | 'available'

/** Le ton d'un badge : une couleur de la charte, rien d'autre. */
export type StatusTone = 'success' | 'accent' | 'warning' | 'neutral'

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  pending: 'En attente',
  approved: 'Approuvée',
  processing: 'En cours',
  partial: 'Partiel',
  available: 'Disponible',
}

export const REQUEST_STATUS_TONES: Record<RequestStatus, StatusTone> = {
  pending: 'warning',
  approved: 'neutral',
  processing: 'accent',
  partial: 'accent',
  available: 'success',
}

/** `null` : rien à afficher, le média n'est ni demandé ni présent. */
export const AVAILABILITY_LABELS: Record<AvailabilityStatus, string | null> = {
  unknown: null,
  pending: 'Demandé',
  processing: 'En cours',
  partial: 'Partiel',
  available: 'Disponible',
}

export const AVAILABILITY_TONES: Record<AvailabilityStatus, StatusTone> = {
  unknown: 'neutral',
  pending: 'warning',
  processing: 'accent',
  partial: 'accent',
  available: 'success',
}

export function isRequestStatus(value: unknown): value is RequestStatus {
  return typeof value === 'string' && (REQUEST_STATUSES as readonly string[]).includes(value)
}

/** Le plus avancé de plusieurs statuts (une ligne regroupant des saisons). */
export function furthestStatus(statuses: readonly RequestStatus[]): RequestStatus {
  let best: RequestStatus = 'pending'
  for (const status of statuses) {
    if (REQUEST_STATUSES.indexOf(status) > REQUEST_STATUSES.indexOf(best)) best = status
  }
  return best
}

/**
 * Le statut d'une demande d'après ce que Radarr/Sonarr disent du média.
 * « Demandé » sans fichier ni téléchargement ne fait pas reculer une demande :
 * seuls un téléchargement, un fichier partiel ou complet la font avancer.
 */
export function requestStatusFrom(current: RequestStatus, availability: AvailabilityStatus): RequestStatus {
  switch (availability) {
    case 'available':
      return 'available'
    case 'partial':
      return 'partial'
    case 'processing':
      return 'processing'
    case 'pending':
      // Le téléchargement a quitté la file sans fichier (échec, retrait) : la demande attend une autre release.
      return current === 'processing' ? 'approved' : current
    case 'unknown':
      return current
  }
}
