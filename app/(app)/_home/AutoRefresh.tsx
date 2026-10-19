'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/**
 * Rafraîchit la page toutes les `seconds` secondes tant qu'elle est visible :
 * lectures en cours et débits restent à jour sans recharger l'écran. Un
 * onglet en arrière-plan ne coûte rien, et revenir dessus rafraîchit aussitôt.
 */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter()
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh()
    }, seconds * 1000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') router.refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [router, seconds])
  return null
}
