# ADR-0014 — Un épisode est « Disponible » quand Onyx le lit

- **Statut :** accepté
- **Date :** 2026-10-27
- **Portée :** `lib/requests/onyx-episodes.ts`, `seasonEpisodes` dans `lib/requests/media-tools.ts`,
  `fetchOnyxShowEpisodes` dans `lib/services/onyx/library.ts`, capacité `library_show_episodes`.
  Côté Onyx : son ADR-0082.

## Contexte

Les épisodes d'une saison étaient « Disponible » d'après sorraa (ou Sonarr) : ce qu'ils ont
importé. Un épisode ajouté à la main dans la bibliothèque d'Onyx, que le lecteur lit très bien,
restait « Manquant ». Ça contredisait l'ADR-0010 (Onyx dit ce qui se lit) au niveau de l'épisode.

## Décision

- Onyx rend les épisodes lisibles d'une série en une requête (`GET
  /api/library/shows/:tmdb/episodes`). OnyxHub la fait à l'ouverture d'une saison, avec le jeton
  du compte, et la garde 30 s par série : les saisons suivantes de la même série n'ajoutent aucun
  appel.
- Un épisode qu'Onyx lit est « Disponible », quoi qu'en disent sorraa ou Sonarr. Sinon leur avis
  reste (y compris « ne suit pas la série »).
- Onyx sans la capacité, injoignable ou sans session (poller de fond) : comportement d'avant, sans
  erreur. Le calcul est fait en parallèle de l'appel TMDB de la saison, donc sans latence en plus.

## Conséquences

- Le badge d'un épisode ne dépend plus de l'import par sorraa.
- Les badges de **saison** et de **série** gardent leur règle (ADR-0010) : Onyx n'y décide que du
  titre entier.
