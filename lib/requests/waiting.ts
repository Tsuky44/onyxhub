/**
 * Pourquoi une demande n'est pas en téléchargement, d'après sorraa : ses
 * recherches n'ont trouvé aucune release que le profil accepte. Lisible côté
 * client (aucun accès serveur ici).
 */
export interface RequestWaiting {
  /** L'explication, en français, telle que sorraa la donne. */
  reason: string
  attempts: number
  /** ISO 8601 : la plus proche des prochaines tentatives. */
  nextAttemptAt: string
}

/** Ce que sorraa dit d'une demande, de quoi en tirer l'attente. */
export interface WaitingSource {
  waiting?: { reason: string; attempts: number; nextAttemptAt: string }
}

/** L'attente la plus proche de ces demandes de sorraa, ou `null` quand aucune n'attend. */
export function earliestWaiting(requests: readonly WaitingSource[]): RequestWaiting | null {
  let best: RequestWaiting | null = null
  for (const { waiting } of requests) {
    if (!waiting) continue
    const next = { reason: waiting.reason, attempts: waiting.attempts, nextAttemptAt: waiting.nextAttemptAt }
    if (best === null || Date.parse(next.nextAttemptAt) < Date.parse(best.nextAttemptAt)) best = next
  }
  return best
}

/** « dans 42 min », « dans 5 h », « dans 2 j » ; « à la prochaine passe » quand l'heure est venue. */
function untilText(at: string, now: Date): string {
  const seconds = Math.round((Date.parse(at) - now.getTime()) / 1000)
  if (!Number.isFinite(seconds) || seconds < 60) return 'à la prochaine passe'
  if (seconds < 3600) return `dans ${Math.round(seconds / 60)} min`
  if (seconds < 86_400) return `dans ${Math.round(seconds / 3600)} h`
  return `dans ${Math.round(seconds / 86_400)} j`
}

/** « Release non disponible au téléchargement · nouvelle tentative dans 42 min ». */
export function waitingText(waiting: RequestWaiting, now = new Date()): string {
  const reason = waiting.reason.charAt(0).toUpperCase() + waiting.reason.slice(1)
  return `${reason} · nouvelle tentative ${untilText(waiting.nextAttemptAt, now)}`
}
