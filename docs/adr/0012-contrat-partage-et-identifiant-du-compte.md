# ADR-0012 — Un contrat partagé avec Onyx, et des demandes qui suivent le compte

- **Statut :** accepté
- **Date :** 2026-10-20
- **Portée :** `tests/contract/onyx/`, `lib/requests/onyx-contract.test.ts`,
  `lib/requests/requester.ts`, la colonne `requester_id` (migration `0004_requester_id`),
  `lib/auth/caller.ts`, `lib/auth/viewer.ts`, `app/api/request/route.ts`. Côté Onyx : son
  ADR-0075.

## Contexte

Les ADR-0002 et 0009 à 0011 ont posé une dizaine de messages entre OnyxHub et Onyx. Chaque côté
avait ses propres types, recopiés à la main ; seuls les tests de chaque dépôt les gardaient,
chacun de son côté.

Les demandes étaient rattachées au nom du compte (`X-Player-Username`, comme chez MediaHub) :
un compte renommé dans Onyx ne retrouvait plus les siennes.

## Décision

- **`tests/contract/onyx/`** copie `contract/onyxhub/` du dépôt d'Onyx (plus `ping.json`,
  `watch_list.json` et `watch_lists.json`). `onyx-contract.test.ts` y fait passer les vrais
  codes d'OnyxHub : ce qu'il écrit doit valoir le fichier, ce qu'il lit doit s'y lire.
  - Quand le dépôt d'Onyx est à côté (`../project playeur`, ou `ONYX_REPO`), la copie doit
    lui être identique. En CI, où il n'y est pas, ce contrôle est sauté.
  - Le test vérifie aussi que chaque capacité d'Onyx dont OnyxHub dépend est annoncée par le
    `ping.json` actuel.
- **`requester_id`** retient l'identifiant Onyx du compte : `X-Player-Id` envoyé par Onyx, ou
  la session. Les lectures restent par nom, sans être réécrites. À chaque passage d'un
  compte identifié, `rememberRequester` :
  - rattache à son identifiant ses anciennes demandes faites sous son nom ;
  - recopie son nom actuel sur ses demandes s'il a changé.

  Rien n'est fait quand le couple (identifiant, nom) a déjà été vu.

## Conséquences

- Un format qui change dans Onyx sans que la copie suive fait échouer `pnpm check` en local.
- Un compte renommé dans Onyx retrouve ses demandes au premier passage, par l'app ou par le web.
- Une demande sans identifiant, faite avant cette version sous le nom d'un compte supprimé
  puis recréé sous le même nom, est rattachée au nouveau compte : le nom était la seule trace.
