/**
 * Films et séries n'ont pas les mêmes genres chez TMDB : « Action &
 * Aventure » (10759) côté séries regroupe Action (28) et Aventure (12) côté
 * films, etc. La découverte mixte (onglet « Tout ») traduit le filtre choisi
 * vers chaque catalogue. Table reprise de MediaHub.
 */
const TV_TO_MOVIE: Record<number, number[]> = {
  10759: [28, 12], // Action & Aventure
  10765: [878, 14], // Science-Fiction & Fantastique
  10768: [10752], // Guerre & Politique
  // Genres propres aux séries, sans équivalent film : ignorés côté films.
  10762: [], // Enfants
  10763: [], // Actualités
  10764: [], // Téléréalité
  10766: [], // Feuilleton
  10767: [], // Talk-show
}

const MOVIE_TO_TV: Record<number, number[]> = {
  28: [10759],
  12: [10759],
  878: [10765],
  14: [10765],
  10752: [10768],
}

function translate(ids: readonly number[], table: Record<number, number[]>): number[] {
  return [...new Set(ids.flatMap((id) => table[id] ?? [id]))]
}

export function genresForMovies(ids: readonly number[]): number[] {
  return translate(ids, TV_TO_MOVIE)
}

export function genresForShows(ids: readonly number[]): number[] {
  return translate(ids, MOVIE_TO_TV)
}
