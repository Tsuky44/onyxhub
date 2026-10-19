'use server'

import { revalidatePath } from 'next/cache'
import { getViewer } from '@/lib/auth/viewer'
import { setSubscription } from '@/lib/calendar/subscriptions'
import { cleanMediaItem, type MediaItem } from '@/lib/requests/media-item'

/** Abonne ou désabonne le compte ; renvoie l'état final (l'ancien si le média est invalide). */
export async function setSubscriptionAction(item: MediaItem, wanted: boolean): Promise<boolean> {
  const viewer = await getViewer()
  const media = cleanMediaItem(item)
  if (!media) return !wanted
  const result = setSubscription(viewer.id, media, wanted === true)
  revalidatePath('/calendrier')
  return result
}
