'use client'

import { useEffect, useState } from 'react'
import type { DownloadProgress } from '@/lib/requests/downloads'
import { advance, isMoving } from '@/lib/requests/live-progress'

/** Une estimation par seconde : avec la transition de la barre, l'œil voit un mouvement continu. */
const TICK_MS = 1_000

/** La dernière mesure reçue du serveur, avec l'heure (du navigateur) de sa réception. */
export interface Measured {
  downloads: Readonly<Record<string, DownloadProgress>>
  /** L'âge de la mesure à l'envoi, en millisecondes. */
  age: number
  receivedAt: number
}

/**
 * Les téléchargements tels que la barre les montre maintenant : la dernière
 * mesure prolongée à sa vitesse (voir live-progress). Le minuteur ne tourne
 * que si un téléchargement avance, et ne fait rien quand l'onglet est caché.
 */
export function useLiveDownloads(measured: Measured): Record<string, DownloadProgress> {
  const [shown, setShown] = useState(() => advance({}, measured.downloads, measured.age))
  const [seen, setSeen] = useState(measured)
  if (seen !== measured) {
    setSeen(measured)
    setShown((previous) => advance(previous, measured.downloads, measured.age))
  }

  const moving = Object.values(measured.downloads).some(isMoving)
  useEffect(() => {
    if (!moving) return
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      setShown((previous) => advance(previous, measured.downloads, Date.now() - measured.receivedAt + measured.age))
    }, TICK_MS)
    return () => clearInterval(timer)
  }, [moving, measured])

  return shown
}
