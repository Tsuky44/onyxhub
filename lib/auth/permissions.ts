import type { OnyxUser } from '../services/onyx/types'

export interface Viewer {
  id: number
  name: string
  isOwner: boolean
  /** Peut configurer OnyxHub et voir le résumé du serveur. */
  isAdmin: boolean
  /** Peut demander des médias. */
  canRequest: boolean
}

/**
 * Les droits d'OnyxHub, déduits des permissions Onyx (ADR-0001). Le
 * propriétaire a tout, même si ses cases de permission sont vides, comme dans
 * Onyx où `is_owner` passe avant le reste.
 */
export function toViewer(user: OnyxUser): Viewer {
  return {
    id: user.id,
    name: user.username,
    isOwner: user.is_owner,
    isAdmin: user.is_owner || user.permissions?.manage_settings === true,
    canRequest: user.is_owner || user.permissions?.request_media === true,
  }
}
