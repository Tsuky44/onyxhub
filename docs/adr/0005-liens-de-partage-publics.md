# ADR-0005 — Les liens de partage de fichiers sont les seules pages publiques d'OnyxHub

- **Statut :** accepté. Vérifié par des tests de la route (`lib/files/shares.test.ts`) ; pas encore contre un vrai partage SMB.
- **Date :** 2026-10-19
- **Portée :** `app/partage/`, `app/api/partage/`, `lib/files/shares.ts`, `proxy.ts`.

## Contexte

MediaHub permettait de partager un fichier ou un dossier du partage SMB par un lien, à quelqu'un sans compte. C'est dans le périmètre de la phase 6. Mais une page sans compte contredit ADR-0001 (toute identité vient d'Onyx), et l'implémentation de MediaHub avait trois failles : mot de passe gardé en clair, comparé sans temps constant, et passé dans l'URL (`?password=`, donc dans les journaux du proxy et l'historique).

## Décision

- `/partage/<jeton>` et `/api/partage/<jeton>` sont les seuls chemins publics hors connexion et contrat Onyx. Le jeton (144 bits aléatoires) tient lieu d'accès à **un** fichier ou dossier, rien d'autre.
- Le mot de passe facultatif est haché (scrypt, sel par lien), comparé en temps constant, envoyé en POST depuis un formulaire, jamais dans l'URL. Cinq essais ratés bloquent le lien dix minutes.
- Un lien expire (24 h, 7 j, 30 j) ou non ; il est révocable et compte ses téléchargements. Supprimer un élément du partage révoque les liens qui y mènent.
- Tout chemin passe par `splitPath`, qui refuse `..` : MediaHub ne le vérifiait qu'au téléchargement, pas dans l'explorateur ni la suppression.

## Conséquences

- Les créateurs de liens sont des admins (la page Téléchargements leur est réservée) : un membre ne peut rien exposer.
- Le blocage des essais vit en mémoire : un redémarrage le remet à zéro. Suffisant pour un serveur domestique ; un attaquant patient reste ralenti par scrypt.
- Le jeton reste en clair en base pour pouvoir réafficher le lien à copier. Lire la base donne déjà accès au partage SMB (ses identifiants y sont, chiffrés par la même clé).
