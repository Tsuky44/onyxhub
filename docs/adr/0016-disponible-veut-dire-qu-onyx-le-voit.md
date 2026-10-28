# ADR-0016 — Avec sorraa, « disponible » veut dire qu'Onyx le voit

- **Statut :** accepté
- **Date :** 2026-10-28
- **Portée :** `seenByOnyx` et `cardStatus` dans `lib/requests/onyx-presence.ts`,
  `presentedStatus` et `presentedAvailability` dans `lib/requests/sorraa-status.ts`,
  `lib/requests/catalog.ts`. Précise l'ADR-0015. Côté Onyx : son ADR-0085.

## Contexte

L'ADR-0015 fait lire la disponibilité chez sorraa, où « disponible » veut dire « téléchargé ».
Un titre en cours d'import chez sorraa, pas encore indexé par Onyx, s'affichait « disponible »
sur les cartes et la fiche alors qu'on ne pouvait pas le lire. Les demandes avaient déjà la
bonne règle (`statusFromSorraaAndOnyx`) : « disponible » ne vient que d'Onyx.

## Décision

Avec sorraa branché, une carte ou une fiche n'est « disponible » ou « partielle » que si l'index
d'Onyx a le titre. Sinon `seenByOnyx` la ramène à « en cours ». Les statuts de demande (demandé,
en cours) et « inconnu » ne changent pas.

- Les cartes (catalogue, « plus tard ») passent par `cardStatus`.
- La fiche passe par `presentedAvailability`, qui applique la règle dès que sorraa a répondu, avec
  ou sans demande. Les saisons suivent la présence du titre : Onyx ne connaît que le titre, ses
  épisodes étant lus à part (ADR-0014).
- Sans sorraa, Radarr et Sonarr gardent leur mot : `withOnyxPresence` seul.

## Conséquences

- Si l'index d'Onyx est injoignable (Onyx éteint, trop ancien), les cartes « disponibles » de
  sorraa passent « en cours » : on ne dit « disponible » que ce qu'on sait lisible.
- Onyx applique la même règle de son côté sur ce qu'OnyxHub lui renvoie (son ADR-0085).
