import { describe, expect, it } from 'vitest'
import type { OnyxPermissions, OnyxUser } from '../services/onyx/types'
import { toViewer } from './permissions'

const none: OnyxPermissions = {
  manage_settings: false,
  manage_library: false,
  manage_users: false,
  delete_media: false,
  invite_users: false,
  request_media: false,
  share_media: false,
}

function user({ permissions, ...rest }: Partial<Omit<OnyxUser, 'permissions'>> & { permissions?: Partial<OnyxPermissions> } = {}): OnyxUser {
  return { id: 7, username: 'lea', is_owner: false, otp_enabled: false, ...rest, permissions: { ...none, ...permissions } }
}

describe('droits déduits des permissions Onyx', () => {
  it('donne tout au propriétaire, même sans aucune case cochée', () => {
    expect(toViewer(user({ is_owner: true }))).toMatchObject({ isAdmin: true, canRequest: true, isOwner: true })
  })

  it("fait admin un compte qui a manage_settings", () => {
    expect(toViewer(user({ permissions: { manage_settings: true } })).isAdmin).toBe(true)
  })

  it("ne fait pas admin un compte qui gère seulement la médiathèque ou les comptes", () => {
    expect(toViewer(user({ permissions: { manage_library: true, manage_users: true } })).isAdmin).toBe(false)
  })

  it('laisse demander un compte par défaut (request_media)', () => {
    expect(toViewer(user({ permissions: { request_media: true } }))).toMatchObject({ isAdmin: false, canRequest: true })
  })

  it("refuse les demandes à un compte sans request_media", () => {
    expect(toViewer(user()).canRequest).toBe(false)
  })
})
