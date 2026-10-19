# ADR-0001 — Onyx est la source de vérité des comptes

- **Statut :** accepté. Le shell de la phase 0 passe par un `getViewer()` à valeur fixe ; la session Onyx arrive en phase 1.
- **Date :** 2026-10-19
- **Portée :** `lib/auth/`, `app/(app)/layout.tsx`, toutes les pages et routes connectées.

## Contexte

MediaHub avait ses propres comptes (NextAuth), des rôles et permissions CASL, des groupes, des invitations, des demandes d'accès, et l'import d'utilisateurs Emby, Jellyfin et Plex. Onyx sait déjà tout cela : premier compte propriétaire, invitations, permissions fines (`manage_settings`, `request_media`…, ADR-0001 d'Onyx), validation en deux étapes (ADR-0041 d'Onyx). Garder les deux, c'était deux listes d'utilisateurs à réconcilier par nom (`X-Player-Username`), avec un repli sur un compte « player-unknown » quand le nom ne correspondait pas.

## Décision

OnyxHub n'a **aucune table d'utilisateurs**. On se connecte avec son compte Onyx : `POST {ONYX}/api/auth/login` (puis `/api/auth/otp/login` si la 2FA est active), le token est gardé côté serveur dans une session chiffrée en cookie httpOnly, et `GET /api/auth/me` donne le compte et ses permissions.

- Admin = `manage_settings` (ou propriétaire).
- Peut demander = `request_media`.
- `lib/auth/viewer.ts` (`getViewer()`, `requireAdmin()`) est le seul point d'entrée de l'identité.

Les tables qui ont besoin d'un compte (demandes, abonnements au calendrier) stockent l'identifiant et le nom d'utilisateur Onyx.

## Conséquences

- OnyxHub ne fonctionne pas sans le serveur Onyx joignable : c'est voulu, il lui est dédié.
- Un changement de permission dans Onyx s'applique à la prochaine lecture de `/api/auth/me`, sans synchronisation.
- Les demandes envoyées par l'app Onyx (via `X-Player-Username`) et celles faites dans OnyxHub désignent le même compte, sans table de correspondance.
