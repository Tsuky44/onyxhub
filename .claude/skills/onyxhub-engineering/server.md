# Serveur (Next.js côté serveur)

Pour trouver l'endroit exact, pars de l'arborescence `app/` (pages et routes `app/api/**/route.ts`) et des services de `lib/services/`.

## Découpage

| Dossier | Responsabilité |
|---|---|
| `app/(app)/**` | Pages connectées, rendues côté serveur. Lisent les données en appelant les services directement. |
| `app/api/**/route.ts` | HTTP seulement : le contrat appelé par le serveur Onyx, les webhooks Radarr/Sonarr, le flux SSE de qBit, les besoins du client. Décoder, autoriser, appeler un service, encoder. |
| `app/**/actions.ts` | Server actions des mutations déclenchées par l'UI. Même finesse qu'une route. |
| `lib/services/<service>/` | Un module par système externe (`onyx`, `tmdb`, `radarr`, `sonarr`, `qbittorrent`, `prowlarr`, `smb`). Interface étroite, réponses typées, URL et clés invisibles de l'appelant. |
| `lib/auth/` | Session Onyx et `getViewer()` / `requireAdmin()`. Seul point d'entrée de l'identité. |
| `lib/db/` | Drizzle + better-sqlite3 (WAL) : schéma, migrations, accès. |
| `lib/settings/` | Réglages et secrets chiffrés en base. |

Une route reste **mince**. Dès que la logique dépasse « lire → un appel → répondre », elle part dans une fonction pure et testable, ou dans le service du domaine.

## Autorisation

- Toute page ou route connectée passe par `getViewer()` ; une page admin commence par `await requireAdmin()`.
- On autorise par *capacité* Onyx : `manage_settings` → admin, `request_media` → peut demander.
- Les routes appelées par le serveur Onyx (`POST /api/request`, `GET /api/media/availability/:id`) exigent `Authorization: Bearer <clé d'intégration>` comparée en temps constant, et lisent `X-Player-Username`. MediaHub laissait la disponibilité publique : ici, aucune route n'est publique sans un commentaire qui dit pourquoi et ce qu'elle expose.
- Une server action revérifie le droit elle-même : être appelée depuis une page admin ne prouve rien.

## Contrat avec Onyx

Les deux routes appelées par le serveur Go gardent exactement le format de MediaHub (voir `PLAN.md` §2). Leur forme est épinglée par un test de contrat ; la changer impose de changer `server/handlers/mediahub.go` dans Onyx dans le même mouvement.

## Services externes

- Un seul helper HTTP (`lib/http.ts`, phase 2) : délai par appel (`AbortSignal.timeout`), en-têtes, erreurs avec contexte et **sans** la clé ni l'URL complète.
- Un service se teste avec `fetch` simulé (Vitest) sur des réponses réelles enregistrées dans `tests/fixtures/<service>/`.
- Cache en mémoire : toujours avec un TTL et un plafond. Ce qui doit survivre à un redémarrage (affiches) va sur disque dans `data/`.
- Les secrets ne quittent jamais le serveur : aucun composant client ne reçoit une URL contenant une clé.

## Base de données

- Drizzle seulement (MediaHub avait Prisma **et** Drizzle). Requêtes paramétrées, transactions pour les écritures liées.
- Une migration publiée ne se modifie jamais.
- Un index accompagne toute colonne filtrée ou jointe.

## Tâches de fond

- Un singleton par tâche (poller qBit, poller de disponibilité), démarré à la demande, arrêté quand plus personne n'écoute.
- Une tâche de fond ne fait jamais tomber le process : erreurs attrapées et journalisées, avec un recul en cas d'échecs répétés.

## Tests

- Vitest, fichiers `*.test.ts` à côté du code.
- Un test porte le nom de la règle qu'il protège (« ne réenvoie pas une saison déjà demandée »), pas de la fonction.
