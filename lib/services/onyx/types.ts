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

export interface OnyxPing {
  status: string
  version: string
}
