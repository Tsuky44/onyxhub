# ADR-0002 — Le contrat de MediaHub est gardé pour le serveur Onyx

- **Statut :** accepté. Les routes arrivent en phase 3.
- **Date :** 2026-10-19
- **Portée :** `app/api/request/route.ts`, `app/api/media/availability/[id]/route.ts` (phase 3), et dans Onyx `server/handlers/mediahub.go`, `tmdb_requests.go`, `tmdb_shared.go`.

## Contexte

Le serveur Onyx parle déjà à MediaHub, réglé par `mediahub_url` et `mediahub_api_key`. Une lecture du code Go montre qu'il n'appelle que deux routes : `POST /api/request` (envoi d'une demande) et `GET /api/media/availability/:id?type=movie|tv` (enrichissement du catalogue de demandes). Les autres handlers (`MediaHubCatalog`, `MediaHubDetails`) ne sont branchés sur aucune route.

Dans MediaHub, la route de disponibilité répondait sans aucune authentification.

## Décision

OnyxHub expose ces deux routes **au même format** que MediaHub : body `{ tmdbId, mediaType, title?, posterPath?, seasons? }` d'un côté, réponse `{ status, seasons: [{ seasonNumber, status }] }` de l'autre. Toutes deux exigent `Authorization: Bearer <clé d'intégration>`, comparée en temps constant, et identifient le compte par `X-Player-Username`.

Un test de contrat épingle ces formes, sur le modèle de `contract/` d'Onyx (ADR-0051 d'Onyx).

## Conséquences

- La bascule se fait sans toucher au code Go : on change `mediahub_url` (et la clé) dans les réglages d'Onyx.
- La disponibilité n'est plus lisible sans la clé.
- Changer ces formes impose de modifier `server/handlers/mediahub.go` dans Onyx dans le même mouvement.
