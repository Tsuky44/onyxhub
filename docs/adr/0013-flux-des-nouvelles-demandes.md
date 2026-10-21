# ADR-0013 — Un flux des nouvelles demandes, relevé par l'app Onyx des administrateurs

- **Statut :** accepté. Testé des deux côtés ; **aucune notification n'a encore été vue arriver
  sur un téléphone**.
- **Date :** 2026-10-21
- **Portée :** `lib/requests/feed.ts`, `requestsAfter` et `lastRequestId` dans
  `lib/requests/repository.ts`, `parseFeedCursor` et `requestFeedPayload` dans
  `lib/requests/contract.ts`, `app/api/request/feed/route.ts`,
  `tests/contract/onyx/request_feed.json`. Côté Onyx : son ADR-0077.

## Contexte

Un administrateur veut savoir, sur son téléphone, qu'un compte vient de demander un média : quoi,
quelles saisons, et qui. OnyxHub ne peut rien pousser à un téléphone : l'app Onyx n'a pas de push
(ADR-0059 d'Onyx — les clés FCM et APNs ne peuvent pas vivre sur un serveur auto-hébergé). Elle
interroge déjà ses serveurs en tâche de fond pour les nouveaux épisodes.

## Décision

- **`GET /api/request/feed?after=<curseur>`**, clé d'intégration seulement. Le serveur Onyx le
  relaie sous `GET /api/requests/feed` à un compte qui a `manage_settings` : c'est lui qui
  décide qui est administrateur (ADR-0001), OnyxHub ne fait que répondre.
- **Le curseur est l'identifiant de ligne**, pas `requestedAt` : la date est prise avant l'appel
  à Radarr ou Sonarr, la ligne écrite après. Une demande lente serait arrivée avec une date déjà
  dépassée par un curseur et n'aurait jamais été annoncée. Les saisons d'un lot sont insérées
  dans une même transaction : un curseur ne coupe jamais un lot.
- **Un lot par entrée** (`batchId`), avec ses saisons : une série demandée en trois saisons est
  une notification.
- **Sans `after`, rien n'est rendu** et le curseur est posé au bout : activer les notifications
  n'annonce pas l'historique.
- **Les demandes de l'appelant sont tues**, le curseur avance quand même : l'administrateur sait
  ce qu'il vient de demander. Comparées par `requesterId`, sinon par nom.
- Au plus **20 lots** par passage, les plus récents.
- Aucune table de plus : le flux se lit dans `media_requests`.

## Conséquences

- La notification arrive au passage suivant de l'app : dans le quart d'heure sur Android, quand
  iOS le décide sur iPhone, tout de suite à l'ouverture de l'app.
- Une demande supprimée avant le passage n'est pas annoncée.
- Changer ce format, c'est changer `contract/onyxhub/request_feed.json` dans Onyx et sa copie ici.
