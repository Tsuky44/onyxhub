# ADR-0015 — Avec sorraa, la disponibilité vient de sorraa, pas de Radarr et Sonarr

- **Statut :** accepté
- **Date :** 2026-10-28
- **Portée :** `lib/requests/sorraa-availability.ts`, `lib/requests/media-availability.ts`,
  `lib/requests/catalog.ts`, `lib/requests/availability.ts` (`seriesFromSeasons`),
  `library()` et `allRequests()` dans `lib/services/sorraa/client.ts`. Routes
  `GET /api/media/availability/:id` et `POST /api/media/availability`. Côté Onyx : son ADR-0084.

## Contexte

Avec sorraa branché, les statuts des demandes viennent déjà de lui (`refreshStatuses`), mais la
disponibilité servie aux cartes, à la fiche et surtout à Onyx venait encore de Radarr et Sonarr.
Un titre que sorraa avait téléchargé, ou qu'il cherchait, y était inconnu : OnyxHub répondait
`unknown` à Onyx, qui n'affichait aucune pastille, alors que la fiche d'OnyxHub montrait le bon
état.

## Décision

- Quand `sorraa_url` est renseignée, `mediaAvailability`, `availabilityBatch` et
  `availabilityMapFor` lisent sorraa. Radarr et Sonarr ne sont plus interrogés pour la
  disponibilité, même s'ils sont configurés.
- Un index (`GET /media` avec ses unités, `GET /requests`) est lu d'un passage et gardé 60 s :
  une page de vingt cartes ne coûte pas un appel de plus. `invalidateLibrary` le vide aussi.
- **Film :** disponible si sorraa a le fichier ; sinon l'état de sa demande (en attente, en cours).
- **Série :** chaque saison compte ses épisodes téléchargés contre tous ses épisodes, diffusés ou
  non, comme avec Sonarr (partielle jusqu'au dernier) ; « en cours » et « demandée » viennent de
  la demande de sorraa. Une saison seulement suivie dans la bibliothèque, sans demande, reste
  inconnue : sorraa peut suivre un titre que personne n'a demandé.
- **Sorraa injoignable :** les cartes restent sans statut pendant 10 s au lieu de planter la page
  ou de retomber sur Radarr, qui contredirait sorraa.
- Sans sorraa, rien ne change : Radarr et Sonarr servent la disponibilité.

## Conséquences

- OnyxHub renvoie à Onyx ce que sorraa sait, y compris « demandé » et « en cours ».
- La présence dans Onyx reste ajoutée par Onyx lui-même (son ADR-0084) : OnyxHub ne peut pas
  lire l'index d'Onyx pour un appel à clé d'intégration.
- La qualité de l'index dépend de la taille de la bibliothèque de sorraa (200 médias par page,
  vingt pages au plus). Au-delà, les titres suivants sont ignorés.
- Les téléchargements (file de qBittorrent, progression des demandes) lisent encore Radarr et
  Sonarr : hors de cette décision.
