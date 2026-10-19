/** Un compte Onyx tel que le renvoient `/api/auth/login` et `/api/auth/me` (`models.User` côté Go). */
export interface OnyxUser {
  id: number
  username: string
  is_owner: boolean
  otp_enabled: boolean
  permissions: OnyxPermissions
}

export interface OnyxPermissions {
  manage_settings: boolean
  manage_library: boolean
  manage_users: boolean
  delete_media: boolean
  invite_users: boolean
  request_media: boolean
  share_media: boolean
}

/** Le 401 d'une connexion qui attend un code de validation en deux étapes (`OTPChallengeResponse`). */
export interface OnyxOtpChallenge {
  challenge: string
  /** La 2FA est obligatoire et pas encore configurée : `secret` et `uri` servent à l'ajouter. */
  setup: boolean
  secret?: string
  uri?: string
}

export type OnyxLoginResult =
  | { kind: 'ok'; token: string; user: OnyxUser; recoveryCodes: string[] }
  | { kind: 'otp'; otp: OnyxOtpChallenge }
  | { kind: 'error'; message: string }

/** Une lecture en cours (`GET /api/admin/activity`, `NowPlaying` côté Go). */
export interface OnyxNowPlaying {
  session_id: string
  user_id: number
  username: string
  device_name: string
  client: string
  is_local: boolean
  media_id: number
  media_type: string
  title: string
  subtitle?: string
  show_title?: string
  poster_url?: string
  position_seconds: number
  duration_seconds: number
  paused: boolean
  play_method: string
  quality?: string
  started_at: string
  updated_at: string
}

export interface OnyxStatBucket {
  key: string
  label: string
  secondary?: string
  poster_url?: string
  media_type?: string
  plays: number
  watched_seconds: number
}

/** `GET /api/admin/stats?days=N` (`PlaybackStats` côté Go). */
export interface OnyxPlaybackStats {
  days: number
  totals: { plays: number; watched_seconds: number; active_users: number; movies: number; episodes: number }
  daily: { date: string; plays: number; watched_seconds: number }[]
  hour_of_day: number[]
  top_users?: OnyxStatBucket[]
  top_media: OnyxStatBucket[]
  clients: OnyxStatBucket[]
  play_methods: OnyxStatBucket[]
}

/** `GET /api/admin/server` (`ServerInfo` côté Go). */
export interface OnyxServerInfo {
  started_at: string
  uptime_seconds: number
  go_version: string
  os: string
  arch: string
  cpus: number
  memory_bytes: number
  database_bytes: number
  transcodes: number
  now_playing: number
  users: number
  active_devices: number
  scanning: boolean
  library: { movies: number; shows: number; episodes: number; total_bytes: number; duration_seconds: number }
}

/** `GET /api/indexer/status` : seuls les indicateurs d'activité sont lus. */
export interface OnyxScanStatus {
  is_scanning: boolean
  is_backfilling_metadata: boolean
  is_redetecting_all: boolean
  is_extracting_subtitles: boolean
}

export interface OnyxPing {
  status: string
  version: string
}
