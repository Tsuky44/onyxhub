/**
 * Ce qu'un nom de release laisse deviner : titre, année, série ou film.
 * Sert seulement quand ni Radarr ni Sonarr ne connaissent le torrent
 * (ajouté à la main) ; MediaHub en faisait sa seule source.
 */
export interface GuessedRelease {
  title: string
  year: number | null
  mediaType: 'movie' | 'tv'
  season: number | null
}

const VIDEO_EXTENSION = /\.(mkv|mp4|avi|m4v|ts|wmv|mov)$/i
const TV_MARKER = /\b(?:s(\d{1,2})(?:e\d{1,3})?|saison\s*(\d{1,2})|season\s*(\d{1,2})|integrale|complete)\b/i
const YEAR = /\b(19[2-9]\d|20[0-4]\d)\b/
/** Ce qui suit le titre dans un nom de release : qualité, source, codec, langue. */
const NOISE =
  /\b(?:2160p|1080p|720p|480p|4k|uhd|hdr\d*|dv|bluray|blu-ray|bdrip|brrip|web(?:-?dl|rip)?|hdtv|dvdrip|remux|x26[45]|h\.?26[45]|hevc|av1|aac|ac3|dts|ddp?5\.1|truehd|atmos|multi|vff|vfq|vf2?|vostfr|french|truefrench|subfrench|custom|hdlight|proper|repack|10bit)\b/i

export function guessRelease(name: string): GuessedRelease | null {
  let text = name.replace(VIDEO_EXTENSION, '')
  // Un groupe entre crochets en tête ([Team] Titre…) n'est pas le titre.
  text = text.replace(/^\s*\[[^\]]*\]\s*/, '')
  text = text.replace(/[._]+/g, ' ').replace(/\s+/g, ' ').trim()

  const tv = TV_MARKER.exec(text)
  const year = YEAR.exec(text)
  const noise = NOISE.exec(text)
  const cuts = [tv?.index, year?.index, noise?.index].filter((index): index is number => typeof index === 'number')
  const end = cuts.length > 0 ? Math.min(...cuts) : text.length
  const title = text
    .slice(0, end)
    .replace(/[([{-]+\s*$/, '')
    .trim()
  if (title.length < 2) return null
  const seasonText = tv?.[1] ?? tv?.[2] ?? tv?.[3]
  return {
    title,
    year: year ? Number(year[1]) : null,
    mediaType: tv ? 'tv' : 'movie',
    season: seasonText ? Number(seasonText) : null,
  }
}
