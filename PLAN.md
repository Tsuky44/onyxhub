# OnyxHub — plan de refonte

> Remplaçant de MediaHub, dédié uniquement à **Onyx**. Mêmes fonctions utiles, code propre, DA Onyx.
> Rédigé le 2026-10-19 à partir de `../mediahub/next-app` et `../project playeur`.

## Décisions (validées le 2026-10-19)

- Stack : **Next.js + TypeScript**.
- Téléchargements : qBittorrent + **recherche Prowlarr** + **recherche interactive** sur la fiche + **fichiers SMB avec partage**. Pas de ratio des trackers privés (Playwright).
- Notifications : **pas en v1**.
- Données : **on repart de zéro**, sans import des demandes MediaHub.

---

## 1. Ce qu'on garde de MediaHub, ce qu'on jette

| Garde (refait propre) | Jette |
|---|---|
| Demandes (découverte TMDB, fiche, saisons, envoi Radarr/Sonarr, liste des demandes) | Emby / Jellyfin / Plex (Onyx seul serveur média) |
| Calendrier des sorties (Radarr/Sonarr + abonnements perso) | Docker / Unraid / terminal / stacks |
| Téléchargements qBittorrent (cache `sync/maindata`, actions, détail) | Support / tickets, messages système, mise à jour système |
| Prowlarr, recherche interactive, fichiers SMB + partage | Ratio des trackers privés (Playwright + cookies) |
| Proxy et cache des posters | Comptes MediaHub, rôles CASL, groupes, invitations, demandes d'accès (Onyx les gère déjà) |
| Contrat d'intégration appelé par le serveur Onyx | Stats de lecture Emby, tracker socket.io, WatchEvent |
| Paramètres admin (URL/clé des services) | Notifications (WhatsApp, Discord, Web Push) : hors v1 |
| | Prisma + Drizzle en double, 258 fichiers `'use client'`, 1 017 `any` |

## 2. Architecture

- **Next.js 16 (App Router, RSC d'abord) + TypeScript strict**, un seul process, une seule image Docker.
- **SQLite (better-sqlite3, WAL) + Drizzle** uniquement. Tables minimales : `settings` (secrets chiffrés), `media_requests`, `calendar_subscriptions`, `watch_later` (ou mappé sur les listes Onyx), `audit_log`.
- **Tailwind v4** avec les tokens Onyx en variables CSS. Pas de lib UI lourde.
- **TanStack Query** seulement là où c'est vivant (téléchargements, statut d'une demande). Le reste est rendu serveur.
- **Seams** : un module par service dans `lib/services/` (`onyx`, `tmdb`, `radarr`, `sonarr`, `qbittorrent`, `prowlarr`), chacun avec une interface étroite, testé avec `fetch` simulé (Vitest).
- Garde-fous repris d'Onyx : fichier ≤ 800 lignes (guard test), pas de `catch` vide, pas de `any` (ESLint), commentaires du *pourquoi* en français, ADR dans `docs/adr/`.

### Authentification : Onyx est la source de vérité

- Écran de connexion OnyxHub → `POST {ONYX}/api/auth/login` (+ `/api/auth/otp/login` si 2FA).
- Le token Onyx est gardé côté serveur dans une session chiffrée (cookie httpOnly) ; `GET /api/auth/me` donne l'utilisateur et ses permissions.
- **Admin** = permission `manage_settings` (ou propriétaire). **Peut demander** = `request_media`. Plus aucune table d'utilisateurs ni de rôles à maintenir.

### Contrat avec le serveur Onyx (zéro changement côté Go)

Le serveur Onyx n'appelle que deux routes de MediaHub (vérifié dans `server/handlers/mediahub.go` et `tmdb_requests.go`) :

- `POST /api/request` — body `{ tmdbId, mediaType, title?, posterPath?, seasons? }`
- `GET /api/media/availability/:id?type=movie|tv` — réponse `{ status, seasons[] }`

Auth : `Authorization: Bearer <clé>` + `X-Player-Username`. OnyxHub les expose à l'identique : il suffit de changer `mediahub_url` dans les réglages d'Onyx. Un test de contrat épingle les deux formats (sur le modèle de `contract/` d'Onyx).

> Au passage : dans MediaHub, `/api/media/availability` répond **sans authentification**, et `api/media/image/[id]` contient une **clé TMDB codée en dur**. Les deux disparaissent dans OnyxHub.

## 3. Pages

Navigation façon app Onyx : header glass sur desktop, barre du bas sur mobile.
Utilisateur : **Accueil · Demandes · Calendrier**. Admin : en plus **Téléchargements · Réglages**.

### Accueil (selon le rôle)
- **Tous** : salutation, barre de recherche TMDB, mes demandes récentes avec statut et progression, aperçu des prochaines sorties.
- **Admin, résumé du serveur** :
  - Onyx : lectures en cours (`/api/admin/activity`), stats (`/api/admin/stats`), état du serveur (`/api/admin/server`), scan en cours (`/api/indexer/status`).
  - Demandes en attente / en cours, dernières demandes de tout le monde.
  - qBittorrent : débits ↓/↑, torrents actifs, ratio.
  - Radarr/Sonarr : file d'import, alertes de santé, espace disque.

### Calendrier
- Sorties Radarr (cinéma / numérique / physique) et épisodes Sonarr des médias demandés, vues mois / semaine / liste.
- Mes demandes mises en avant, abonnements perso (bouton « S'abonner » sur la fiche), badge « disponible » quand le fichier est là.

### Demandes — à l'identique de MediaHub
- **Découverte** : onglets Films / Séries, scroll infini, filtres (genres, année, tri, plateformes), recherche.
- **Fiche** : hero + backdrop, synopsis, casting / équipe, mots-clés, collection, similaires / recommandations, bande-annonce, plateformes, badges de dispo.
- **Séries** : saisons et épisodes avec statut par saison, sélecteur de saisons, demande par saison (une ligne par saison, comme aujourd'hui).
- Bouton de demande avec son état, progression du téléchargement sur la fiche (file Radarr/Sonarr ↔ qBit), « À regarder plus tard », « Lire dans Onyx » quand c'est disponible.
- **Admin sur la fiche** : gérer le média (demandes liées, statut Radarr/Sonarr, suppression), recherche interactive des releases.
- **Pages personne et collection.**
- **Liste des demandes** : filtres (statut, type, demandeur), regroupement, sélection multiple et actions groupées pour l'admin, scroll infini.
- Statuts : en attente → approuvée → en cours → partiel → disponible, mis à jour par les webhooks Radarr/Sonarr et un poller de secours.

### Téléchargements (admin)
- Connexion qBit comme aujourd'hui (URL, identifiants, intervalle de polling) dans Réglages.
- Liste : filtres de statut, tags, catégories, trackers, période ; tri ; colonnes au choix ; recherche ; sélection multiple.
- Actions : ajout (fichier .torrent / magnet), pause / reprise, suppression (avec ou sans fichiers), priorité, réannonce, limites de partage.
- Détail d'un torrent : infos, fichiers, trackers, pairs, média et demande liés.
- Stats globales (débits, ratio, session).
- **Recherche Prowlarr** : recherche multi-indexeurs, envoi d'une release vers qBit.
- **Fichiers SMB** : navigation, suppression, liens de partage (création, liste, révocation) et téléchargement par lien.

### Réglages (admin)
URL et clé : Onyx, clé d'intégration, TMDB, Radarr, Sonarr, qBittorrent, Prowlarr, partage SMB. Bouton « Tester » par service. Secrets chiffrés en base.

## 4. Performance — au moins aussi bien que MediaHub

### Posters
MediaHub : `next/image` (AVIF/WebP, cache 1 an) + proxy dont le cache est une `Map` en mémoire, perdu à chaque redémarrage.
OnyxHub :
- `next/image` avec `sizes` justes par breakpoint et la bonne taille TMDB (w185 / w342 / w500 / original) au lieu de w500 partout.
- Proxy `/api/poster/[type]/[tmdbId]` avec **cache disque** (survit aux redémarrages), `ETag` + `Cache-Control: immutable`, résolution des chemins Radarr/Sonarr `mediacover` vers TMDB.
- Chargement paresseux, `priority` seulement au-dessus de la ligne de flottaison, squelette à ratio fixe (aucun saut de mise en page).

### qBittorrent
On reprend ce qui marche dans `qbittorrent-cache.ts`, en mieux :
- Un seul poller côté serveur sur `sync/maindata` **incrémental** (`rid`), tick rapide 5 s (réglable, min 2 s) + tick lent 60 s pour catégories / tags.
- Normalisation snake_case / camelCase, session SID réutilisée, ré-authentification sur 403, remise à zéro du `rid` si réponse incohérente.
- **Nouveau** : le poller dort quand personne ne regarde, et le navigateur reçoit les changements en **SSE** au lieu de re-poller toute la liste.

## 5. Outillage repris d'Onyx

Dans `onyxhub/` :
- `.claude/skills/` : `baseline-ui`, `fixing-accessibility`, `fixing-motion-performance`, `fixing-metadata`, `improve-ui`, `ui-skills-root`, `create-design-md`, `apple-design`, plus `impeccable`, `tasteful-ui`, `ui-ux-pro-max` (venant de `.agents/skills`), et `skills-lock.json`.
- Un skill **`onyxhub-engineering`** adapté de `onyx-engineering` : mêmes règles transverses (modules *deep*, ≤ 800 lignes, guard tests, erreurs, commentaires, ADR), branche TS/Next à la place de Go/Flutter.
- `CLAUDE.md` (« travail silencieux, récap final », économie de tokens), `.claude/settings.json` (refus de lecture sur `.next/`, `node_modules/`, `data/`), `PRODUCT.md`, `design.md` (Quiet Premium), `docs/adr/`, graphe graphify.
- `git init`.

## 6. DA — Quiet Premium (tokens d'Onyx)

- Fonds `#0A0A0A` / `#141414` / `#1C1C1C`, survol `#252525`, bordure `#2C2C2E`.
- Accent `#0A84FF`, utilisé avec parcimonie (focus, progression, sélection). Note `#F5C518` réservée aux étoiles.
- Texte `#F5F5F7` / `#A1A1A6` / `#6E6E73`. Succès `#30D158`, attention `#FF9F0A`, erreur `#FF453A`.
- Manrope (UI) + Geist Mono (badges 4K / HDR, chiffres), comme `onyx-site`.
- Glass seulement sur la nav, les menus et les modales (flou 20–40 px, liseré 8 % blanc). Rayons 16 px (cartes) / 24 px (modales). Survol en échelle 1.05.
- Logo et icônes depuis `project playeur/brand/`. Contraste lisible, cibles ≥ 44 px, `prefers-reduced-motion`.

## 7. Phases

| # | Phase | Livré quand |
|---|---|---|
| 0 ✅ | Socle : git, skills, CLAUDE.md, scaffold Next, tokens, shell de nav, guard tests, CI locale (lint, typecheck, vitest) | page vide navigable, guards verts |
| 1 ✅ | Auth Onyx + Réglages (secrets chiffrés, « Tester ») | connexion avec un compte Onyx, admin vs utilisateur |
| 2 ✅ | Services : TMDB, Radarr, Sonarr, qBit (cache), Prowlarr, client Onyx — testés | tests verts avec réponses simulées |
| 3 ✅ | Demandes : découverte, fiche, saisons, envoi, liste, admin, webhooks + contrat Onyx | une demande depuis l'app Onyx arrive dans OnyxHub |
| 4 ✅ | Accueil utilisateur + résumé admin | les deux variantes affichent des données réelles |
| 5 | Calendrier | sorties et abonnements visibles |
| 6 | Téléchargements : qBit, Prowlarr, fichiers SMB + partage | parité avec la page Téléchargements de MediaHub (hors ratio des trackers) |
| 7 | Passe perf posters, a11y, mobile | vérifié au navigateur en largeur téléphone et desktop |
| 8 | Dockerfile, compose, bascule `mediahub_url` dans Onyx | Onyx tourne sur OnyxHub |

Chaque phase se termine par lint + typecheck + tests verts et un passage dans le navigateur.
