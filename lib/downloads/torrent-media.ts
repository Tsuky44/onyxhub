import 'server-only'
import { errorMessage, NotConfiguredError } from '../http'
import { getLibrary } from '../requests/library'
import { getRadarr } from '../services/arr/radarr'
import { getSonarr } from '../services/arr/sonarr'
import type { HistoryRecord, QueueItem, RadarrMovie, SonarrSeries } from '../services/arr/types'
import { tmdbPosterPath } from '../calendar/releases'
import { getTmdb } from '../services/tmdb/client'
import type { MediaType } from '../services/tmdb/types'
import { guessRelease } from './release-name'

/**
 * Le film ou la série d'un torrent, pour la page de détail. Par ordre de
 * fiabilité : la file de Radarr/Sonarr (le `downloadId` est le hash), leur
 * historique (torrent déjà importé), puis le nom de la release comparé à
 * TMDB. MediaHub ne faisait que la dernière, et se trompait sur les titres
 * courts ou traduits.
 */
export interface TorrentMedia {
  mediaType: MediaType
  tmdbId: number
  title: string
  year: number | null
  posterPath: string | null
  /** Saisons concernées, quand Sonarr les connaît. */
  seasons: number[]
  source: 'radarr' | 'sonarr' | 'nom'
}

const yearOf = (date: string | undefined) => (date ? Number(date.slice(0, 4)) || null : null)

function fromMovie(movie: RadarrMovie): TorrentMedia {
  return { mediaType: 'movie', tmdbId: movie.tmdbId, title: movie.title, year: movie.year ?? null, posterPath: tmdbPosterPath(movie.images), seasons: [], source: 'radarr' }
}

async function fromSeries(series: SonarrSeries, seasons: number[]): Promise<TorrentMedia | null> {
  // Sonarr v3 ne donne pas toujours l'identifiant TMDB : on le retrouve par TVDB.
  const tmdbId = series.tmdbId ?? (await getTmdb().findByTvdb(series.tvdbId).catch(() => null))?.id
  if (!tmdbId) return null
  return { mediaType: 'tv', tmdbId, title: series.title, year: series.year ?? null, posterPath: tmdbPosterPath(series.images), seasons: [...new Set(seasons)].sort((a, b) => a - b), source: 'sonarr' }
}

async function fromArr(hash: string): Promise<TorrentMedia | null> {
  const index = await getLibrary()
  const movies = [...index.movies.values()]
  const series = [...index.seriesByTvdb.values()]
  const same = (item: { downloadId?: string }) => item.downloadId?.toLowerCase() === hash

  const movieItem = index.movieQueue.find(same)
  const movie = movieItem && (movieItem.movie ?? movies.find((candidate) => candidate.id === movieItem.movieId))
  if (movie) return fromMovie(movie)

  const seriesItems: QueueItem[] = index.seriesQueue.filter(same)
  const queuedShow = seriesItems[0] && (seriesItems[0].series ?? series.find((candidate) => candidate.id === seriesItems[0]?.seriesId))
  if (queuedShow) return fromSeries(queuedShow, seriesItems.flatMap((item) => (item.seasonNumber !== undefined ? [item.seasonNumber] : [])))

  const history = async (load: () => Promise<HistoryRecord[]>, service: string) =>
    load().catch((error: unknown) => {
      if (!(error instanceof NotConfiguredError)) console.warn(`[torrent] historique ${service} : ${errorMessage(error)}`)
      return [] as HistoryRecord[]
    })
  const [movieHistory, seriesHistory] = await Promise.all([
    index.radarr ? history(() => getRadarr().history(hash), 'Radarr') : Promise.resolve([]),
    index.sonarr ? history(() => getSonarr().history(hash), 'Sonarr') : Promise.resolve([]),
  ])
  const movieId = movieHistory.find((record) => record.movieId)?.movieId
  const pastMovie = movieId ? movies.find((candidate) => candidate.id === movieId) : undefined
  if (pastMovie) return fromMovie(pastMovie)
  const seriesId = seriesHistory.find((record) => record.seriesId)?.seriesId
  const pastShow = seriesId ? series.find((candidate) => candidate.id === seriesId) : undefined
  if (pastShow) return fromSeries(pastShow, seriesHistory.flatMap((record) => (record.episode?.seasonNumber !== undefined ? [record.episode.seasonNumber] : [])))
  return null
}

async function fromName(name: string): Promise<TorrentMedia | null> {
  const guess = guessRelease(name)
  if (!guess) return null
  const results = (await getTmdb().search(guess.mediaType, guess.title)).results
  const dated = (item: (typeof results)[number]) => yearOf(item.release_date ?? item.first_air_date)
  // Avec une année, on exige une sortie à un an près : mieux vaut rien qu'un film homonyme.
  const match = guess.year ? results.find((item) => Math.abs((dated(item) ?? 0) - (guess.year ?? 0)) <= 1) : results[0]
  if (!match) return null
  return {
    mediaType: guess.mediaType,
    tmdbId: match.id,
    title: match.title ?? match.name ?? guess.title,
    year: dated(match),
    posterPath: match.poster_path,
    seasons: guess.season !== null ? [guess.season] : [],
    source: 'nom',
  }
}

export async function torrentMedia(torrent: { hash: string; name: string }): Promise<TorrentMedia | null> {
  const hash = torrent.hash.toLowerCase()
  const known = await fromArr(hash).catch((error: unknown) => {
    console.warn(`[torrent] média par Radarr/Sonarr : ${errorMessage(error)}`)
    return null
  })
  if (known) return known
  return fromName(torrent.name).catch(() => null)
}
