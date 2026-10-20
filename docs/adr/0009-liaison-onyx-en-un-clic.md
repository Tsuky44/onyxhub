# ADR-0009 — OnyxHub écrit lui-même la liaison dans Onyx, et ajoute deux routes au contrat

- **Statut :** accepté
- **Date :** 2026-10-20
- **Portée :** `lib/integration/onyx-link.ts`, `lib/services/onyx/settings.ts`,
  `app/(app)/reglages/` (bouton « Connecter Onyx »), `app/api/integration/ping/route.ts`,
  `app/api/media/availability/route.ts`, `availabilityBatch` dans
  `lib/requests/media-availability.ts`, `lib/requests/contract.ts`, `proxy.ts`. Côté Onyx :
  son ADR-0072.

## Contexte

Le dernier pas de la phase 8 restait manuel : recopier l'URL d'OnyxHub et la clé
d'intégration dans les réglages d'Onyx, champ « Adresse MediaHub ». Une faute de frappe ne se
voyait qu'à la première demande refusée. Par ailleurs, le serveur Onyx demandait la
disponibilité carte par carte (vingt appels par page du catalogue), alors qu'OnyxHub répond
pour toute une page à partir d'un seul index de bibliothèque.

## Décision

- **« Connecter Onyx »** (carte « Liaison avec Onyx » de Réglages) écrit `mediahub_url` et
  `mediahub_api_key` dans Onyx par `PUT /api/settings`, avec le jeton de l'admin connecté : c'est
  Onyx qui vérifie `manage_settings` (ADR-0001). La clé est créée si elle manque. Puis OnyxHub
  demande à Onyx de tester la liaison (`POST /api/settings/mediahub/test`) : seul un appel parti
  du réseau d'Onyx prouve que l'adresse est la bonne. Un Onyx trop ancien pour ce test (`404`)
  est dit comme tel, sans faire échouer la liaison.
- L'adresse envoyée est `onyxhub_url` si l'admin l'a fixée (un nom Docker, un réseau interne),
  sinon l'origine du navigateur. La carte affiche l'état lu dans Onyx : on reconnaît notre clé
  aux 4 derniers caractères qu'Onyx rend de la sienne.
- **`GET /api/integration/ping`** répond `{ status, service: 'onyxhub', version, features }`
  seulement à la clé d'intégration : c'est la route que le test d'Onyx appelle.
- **`POST /api/media/availability`** prend `{ items: [{ tmdbId, mediaType }] }` (100 au plus) et
  rend `{ results: [...] }` dans le même ordre, chaque média au format de la route unitaire. Le
  repli par TVDB (un appel TMDB par série) n'a lieu que si Sonarr range des séries sans
  identifiant TMDB.
- Les deux routes de MediaHub (ADR-0002) restent servies à l'identique pour les anciens Onyx.

## Conséquences

- La bascule d'Onyx vers OnyxHub se fait en un clic, vérifié de bout en bout.
- Régénérer la clé casse la liaison jusqu'au prochain « Connecter Onyx » : la carte le dit.
- Le contrat avec Onyx compte quatre routes ; leurs formes sont épinglées dans
  `lib/requests/contract.test.ts`, et les changer impose de changer `server/handlers/mediahub*.go`.
