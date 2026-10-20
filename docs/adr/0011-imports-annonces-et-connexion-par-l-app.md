# ADR-0011 — OnyxHub annonce les imports à Onyx, et se connecte par l'app Onyx

- **Statut :** accepté
- **Date :** 2026-10-20
- **Portée :** `lib/integration/onyx-import.ts`, `lib/services/onyx/imports.ts`, les chemins de
  fichiers lus par `lib/requests/webhook-payload.ts`, les webhooks
  `app/api/webhooks/{radarr,sonarr}/route.ts`, `lib/services/onyx/pairing.ts`,
  `app/connexion/pairing-actions.ts` et `app/connexion/AppPairing.tsx`. Côté Onyx : son
  ADR-0074.

## Contexte

- Un film importé par Radarr n'apparaissait dans Onyx qu'au prochain passage de son moniteur.
  Les notifications du système de fichiers ne voient rien sur un partage réseau, et le poll
  passe toutes les 5 minutes. OnyxHub, lui, est prévenu tout de suite par le webhook.
- Se connecter à OnyxHub demandait de retaper son mot de passe Onyx, alors qu'Onyx sait déjà
  connecter un téléviseur par un code qu'un téléphone approuve.

## Décision

- **Sur un webhook `Download`** (import ou mise à niveau), OnyxHub appelle
  `POST {onyx}/api/integrations/onyxhub/imported` avec la clé d'intégration. Le corps donne le
  titre (`tmdbId`, 0 pour une série que Sonarr ne connaît que par TVDB) et les fichiers tels
  que Radarr/Sonarr les voient. L'appel part en parallèle de la réponse au webhook, ne
  bloque rien et n'échoue jamais bruyamment. Il n'est fait que si Onyx annonce
  `onyxhub_import_signal`.
- **« Se connecter avec l'app Onyx »** ouvre un appairage d'appareil d'Onyx au nom
  « OnyxHub (navigateur) » et affiche le code court. On l'approuve depuis l'app (Compte →
  Connecter un appareil), ou en ouvrant `{onyx}/?tv=CODE` dans un Onyx déjà connecté.
  Le navigateur ne reçoit la poignée de l'appairage que scellée par OnyxHub (AES-GCM) : il
  ne peut pas la présenter lui-même à Onyx. Une fois l'appairage approuvé, la session est
  écrite comme après un mot de passe.

## Conséquences

- Un import indexe son dossier quelques secondes après le webhook quand Onyx et Radarr/Sonarr
  voient les mêmes chemins. Sinon, Onyx anticipe au moins le passage de son poll.
- La session ouverte par code apparaît dans les appareils du compte Onyx, et se révoque de
  là comme celle d'un téléviseur.
- Pas de QR code sur la page de connexion : il faudrait une dépendance. Le code se saisit en
  huit caractères.
