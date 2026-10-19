'use client'

import { useCallback, useMemo, useSyncExternalStore } from 'react'

/**
 * Une préférence d'affichage gardée dans `localStorage` (colonnes, tri) :
 * le rendu serveur et la première hydratation prennent la valeur par
 * défaut, puis la valeur enregistrée, sans écart d'hydratation. Un stockage
 * indisponible (navigation privée) laisse simplement la valeur par défaut.
 */
const EVENT = 'onyxhub-stored-value'

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function subscribe(callback: () => void): () => void {
  window.addEventListener('storage', callback)
  window.addEventListener(EVENT, callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener(EVENT, callback)
  }
}

export function useStoredValue<T>(key: string, fallback: T, parse: (raw: string) => T | null): [T, (value: T) => void] {
  const raw = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  )
  const value = useMemo(() => {
    if (raw === null) return fallback
    try {
      return parse(raw) ?? fallback
    } catch {
      return fallback
    }
    // `fallback` et `parse` sont des constantes de l'appelant : seule la valeur brute compte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw])
  const set = useCallback(
    (next: T) => {
      try {
        window.localStorage.setItem(key, JSON.stringify(next))
      } catch {
        // Stockage plein ou interdit : la préférence vaut pour cette page seulement.
      }
      window.dispatchEvent(new Event(EVENT))
    },
    [key],
  )
  return [value, set]
}
