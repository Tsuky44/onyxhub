# ADR-0007 — L'optimiseur de next/image sert de proxy d'affiches

- **Statut :** accepté.
- **Date :** 2026-10-19
- **Portée :** `components/media/Poster.tsx`, `lib/tmdb-image.ts`, `next.config.ts`.

## Contexte

PLAN.md §4 prévoyait une route `/api/poster/[type]/[tmdbId]` avec un cache disque, pour trois raisons : survivre aux redémarrages (MediaHub gardait ses affiches dans une `Map`), servir avec `Cache-Control: immutable`, et traduire les chemins `mediacover` de Radarr/Sonarr en affiches TMDB.

En phase 3, toutes les affiches sont passées par `next/image` (`Poster`), qui fait déjà ce travail : il télécharge l'image une fois, la redimensionne à la largeur demandée, la convertit en AVIF ou WebP, l'écrit sur disque (`.next/cache/images`) et la sert avec un cache d'un an (`minimumCacheTTL`). Les chemins `mediacover` sont déjà traduits en chemins TMDB à la lecture (`tmdbPosterPath`), et les affiches Sonarr venues de TVDB sont remplacées par celles des demandes.

## Décision

Contredit PLAN.md §4 : pas de route `/api/poster`. L'optimiseur de `next/image` est le proxy :

- le navigateur ne contacte jamais TMDB ni fanart.tv directement (pas d'adresse IP du spectateur chez eux) ;
- le cache est sur disque et survit aux redémarrages du process ;
- les formats modernes (AVIF, WebP) viennent en plus, qu'une route maison aurait dû refaire avec `sharp`.

Chaque affiche choisit sa taille TMDB source (`source`) et déclare sa largeur affichée (`sizes`) : la variante servie est la plus petite qui couvre l'écran.

## Conséquences

- Le cache vit dans `.next/cache/images` : en Docker, c'est un volume (`docker-compose.yml`), sinon chaque nouvelle image le viderait. Perdu, il se reconstruit à la demande, une image à la fois.
- Une nouvelle origine d'image s'ajoute à `images.remotePatterns` : rien d'autre ne passe par l'optimiseur.
