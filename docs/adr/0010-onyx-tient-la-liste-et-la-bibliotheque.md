# ADR-0010 — « Plus tard » vit dans Onyx, et OnyxHub sait ce qu'Onyx a déjà

- **Statut :** accepté
- **Date :** 2026-10-20
- **Portée :** `lib/requests/watch-later.ts`, `lib/services/onyx/lists.ts`,
  `lib/services/onyx/capabilities.ts`, `lib/services/onyx/library.ts`,
  `lib/requests/onyx-presence.ts`, `withStatus` dans `lib/requests/catalog.ts`,
  `lib/requests/media-page.ts` et le bouton « Lire dans Onyx » de la fiche, `GET` de
  `app/api/request/route.ts`, réglage `onyx_web_url`. Côté Onyx : son ADR-0073.

## Contexte

Trois choses étaient tenues en double ou pas du tout :

- **« À regarder plus tard »** avait sa table dans OnyxHub, alors qu'Onyx tient depuis son
  ADR-0070 une liste du même nom par compte. Ce qu'on rangeait sur le web n'apparaissait pas
  dans l'app, et inversement. Ça contredisait la règle « Onyx décide » de l'ADR-0001.
- **Ce qu'Onyx a déjà** : OnyxHub ne le savait que par Radarr/Sonarr. Un titre ajouté à
  la main dans la bibliothèque restait « à demander », et rien ne menait de la fiche au
  lecteur.
- **L'app ne voyait pas les demandes du compte** : elle pouvait demander, pas suivre.

## Décision

- **La liste « Plus tard » est celle d'Onyx**, lue et écrite avec le jeton du compte
  (`/api/lists`, élément identifié par `tmdb_id` + `media_type`). La table `watch_later`
  ne sert plus que face à un Onyx sans la capacité `watch_lists`. Ce qu'elle contient est
  versé dans Onyx au premier passage du compte, et chaque ligne n'est effacée qu'une fois
  acceptée par Onyx.
- **OnyxHub lit les capacités d'Onyx** sur `/api/ping` (cache de 5 min) : une fonction qui
  dépend d'une route récente d'Onyx garde son comportement d'avant sur un Onyx plus ancien.
- **L'index d'Onyx** (`GET /api/library/tmdb-index`, 60 s, un seul cache pour tous les
  comptes) fait passer à « disponible » un titre que Radarr/Sonarr disent « inconnu ».
  Dès qu'ils le connaissent, ce sont eux qui décident. La fiche montre alors « Lire dans
  Onyx », qui ouvre `{onyx_web_url ou onyx_url}/?movie=ID` (ou `?show=ID`) dans l'app web.
- **`GET /api/request`** rend les demandes du compte (`X-Player-Username` avec la clé
  d'intégration, ou la session), une page de 30 lots avec leur progression. Onyx la relaie
  à l'app sur `GET /api/requests/mine`. Le ping annonce `my-requests`.

## Conséquences

- La même liste « Plus tard » dans l'app, sur le web et sur la télé.
- Un titre présent dans Onyx n'est plus proposé à la demande sur le web.
- La table `watch_later` reste dans le schéma tant qu'un Onyx ancien peut s'en servir.
  Elle se vide d'elle-même chez ceux qui ont un Onyx à jour.
- « Lire dans Onyx » suppose qu'Onyx soit joignable depuis le navigateur. `onyx_web_url`
  couvre le cas où OnyxHub joint Onyx par un nom interne.
