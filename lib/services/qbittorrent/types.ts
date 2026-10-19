/** Un torrent, normalisé : mêmes noms de champs qu'il vienne de `torrents/info` ou de `sync/maindata`. */
export interface Torrent {
  hash: string
  name: string
  state: string
  progress: number
  dlspeed: number
  upspeed: number
  eta: number
  size: number
  total_size: number
  downloaded: number
  uploaded: number
  downloaded_session: number
  uploaded_session: number
  ratio: number
  num_seeds: number
  num_leechs: number
  num_complete: number
  num_incomplete: number
  added_on: number
  completion_on: number
  last_activity: number
  seeding_time: number
  max_seeding_time: number
  availability: number
  priority: number
  category: string
  tags: string
  tracker: string
  save_path: string
  content_path: string
  ratio_limit: number
  seeding_time_limit: number
  magnet_uri: string
}

export interface ServerState {
  dl_info_speed?: number
  up_info_speed?: number
  dl_info_data?: number
  up_info_data?: number
  alltime_dl?: number
  alltime_ul?: number
  global_ratio?: string
  free_space_on_disk?: number
  connection_status?: string
  dht_nodes?: number
  queueing?: boolean
  use_alt_speed_limits?: boolean
}

export interface Category {
  name: string
  savePath: string
}

/** Une réponse de `sync/maindata` : complète si `full_update`, sinon seulement les différences depuis `rid`. */
export interface MainData {
  rid: number
  full_update?: boolean
  torrents?: Record<string, Partial<Record<keyof Torrent, unknown>>>
  torrents_removed?: string[]
  categories?: Record<string, Partial<Category>>
  categories_removed?: string[]
  tags?: string[]
  tags_removed?: string[]
  server_state?: ServerState
}

export interface TorrentProperties {
  save_path: string
  creation_date: number
  piece_size: number
  comment: string
  total_wasted: number
  total_uploaded: number
  total_downloaded: number
  up_limit: number
  dl_limit: number
  time_elapsed: number
  seeding_time: number
  nb_connections: number
  share_ratio: number
  addition_date: number
  completion_date: number
  created_by: string
  dl_speed_avg: number
  up_speed_avg: number
  eta: number
  seeds: number
  seeds_total: number
  peers: number
  peers_total: number
  total_size: number
  pieces_have: number
  pieces_num: number
  reannounce: number
}

export interface TorrentFile {
  index: number
  name: string
  size: number
  progress: number
  priority: number
  availability?: number
}

export interface TorrentTracker {
  url: string
  status: number
  tier: number
  num_peers: number
  num_seeds: number
  num_leeches: number
  num_downloaded: number
  msg: string
}

export interface TorrentPeer {
  ip: string
  port: number
  client: string
  country_code?: string
  progress: number
  dl_speed: number
  up_speed: number
  downloaded: number
  uploaded: number
  connection: string
  flags: string
}

export interface TransferInfo {
  dl_info_speed: number
  up_info_speed: number
  dl_info_data: number
  up_info_data: number
  connection_status: string
}

export type PriorityMove = 'top' | 'up' | 'down' | 'bottom'

export interface AddTorrentInput {
  urls?: string[]
  files?: File[]
  category?: string
  tags?: string[]
  savePath?: string
  paused?: boolean
}
