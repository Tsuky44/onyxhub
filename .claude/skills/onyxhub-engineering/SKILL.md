---
name: onyxhub-engineering
description: Standards d'ingénierie d'OnyxHub (Next.js + TypeScript, compagnon web d'Onyx pour les demandes, le calendrier et les téléchargements). À charger avant d'écrire, modifier, refactorer ou relire du code de ce dépôt — page, composant, route API, service externe (Onyx, TMDB, Radarr, Sonarr, qBittorrent, Prowlarr, SMB), schéma SQLite ou test.
---

# OnyxHub — ingénierie

OnyxHub remplace MediaHub, mais pour **Onyx seul**. C'est une app Next.js (App Router) + SQLite qui gère les demandes de médias (TMDB → Radarr/Sonarr), le calendrier des sorties et les téléchargements (qBittorrent, Prowlarr, SMB). Onyx reste la source de vérité des comptes et des permissions. Le plan et ses phases sont dans `PLAN.md`.

La barre, héritée d'Onyx : chaque changement laisse le code plus *deep* qu'il ne l'était. Une interface étroite, la logique derrière un seul *seam*, et une preuve (test ou *guard test*) que le comportement tient. MediaHub est le contre-exemple à ne pas reproduire : 258 fichiers `'use client'`, 1 017 `any`, `fetch` éparpillés, deux ORM.

Pendant la tâche, suis la règle « travail silencieux, récap final » du `CLAUDE.md` à la racine.

## Étapes

1. **Orienter.** Lis les ADR de la zone dans `docs/adr/` et la section de `PLAN.md` qui la couvre. Lis le fichier touché et ses voisins pour trouver le *seam* existant (service, helper, composant) qui porte déjà la responsabilité. Pour porter une fonction de MediaHub, lis son code dans `../mediahub/next-app` pour le **comportement**, jamais pour le copier tel quel.
   Cette étape est finie quand tu peux nommer les ADR qui contraignent le changement (ou affirmer qu'aucune ne le fait) et le seam où il va.
2. **Charger la référence de la branche**, une ou plusieurs :
   - Serveur (route API, server action, service externe, base, tâche de fond, contrat Onyx) → [server.md](server.md)
   - Interface (page, composant, tokens, responsive, accessibilité) → [ui.md](ui.md)
3. **Implémenter** en suivant la référence et les règles transverses ci-dessous.
4. **Vérifier**, à la racine : `pnpm check` (ESLint, `tsc --noEmit`, Vitest, guard tests compris). Pour l'UI, regarde la page tourner (skill `run`, `pnpm dev` sur le port 4400) en largeur téléphone (375 px) et desktop.
   Cette étape est finie quand chaque commande est verte et que tu as lu sa sortie. Un échec qui existait avant ton changement se signale, il ne se contourne pas.
5. **Laisser la trace.**
   - Pour une décision difficile à défaire, surprenante, ou qui s'écarte d'une ADR : écris `docs/adr/00NN-titre-en-kebab.md`, en français, au format des existantes (Statut, Date, Portée, Contexte, Décision, Conséquences). Un écart se dit : *« Contredit l'ADR-00NN parce que… »*.
   - Le nouveau comportement est épinglé par un test nommé d'après la règle qu'il protège.

## Règles transverses

### Modules *deep*, *seams*, taille des fichiers

- Une nouvelle responsabilité va dans un nouveau fichier, avec une interface étroite. L'appelant ne voit pas les détails (URL, en-têtes, pagination, formats bruts).
- Aucun fichier ne dépasse 800 lignes (`tests/guards/file-size.test.ts`). Pour ajouter du code à un gros fichier, extrais d'abord le morceau touché.
- Chaque signification a une seule source de vérité : tokens dans `app/globals.css`, icônes dans `lib/icons.ts`, onglets dans `lib/navigation.ts`, identité dans `lib/auth/viewer.ts`. Avant d'écrire un helper, cherche s'il existe déjà.
- **Onyx décide** des comptes et des permissions, **Radarr/Sonarr** de ce qui est surveillé et présent sur disque. OnyxHub affiche et orchestre ; il ne duplique pas ces vérités dans sa base.

### *Guard tests* plutôt que règles écrites

Une convention qui doit tenir dans tout le dépôt devient un test qui scanne le code, dans `tests/guards/` (modèle : `design-tokens.test.ts`) : une liste blanche courte, une justification par entrée, et un message d'échec qui explique le *pourquoi*. Chaque nouvelle convention arrive avec son guard test.

### Commentaires

On commente le *pourquoi* : la panne observée, la mesure, l'alternative écartée, l'ADR (`Voir ADR-0002`), ou ce que faisait MediaHub et pourquoi on s'en écarte. Les commentaires et les ADR s'écrivent en français. Un commentaire qui paraphrase le code se supprime.

### Erreurs

Chaque erreur est traitée, remontée avec son contexte (`new Error('radarr: ajout du film', { cause })`) ou journalisée. Un `catch` qui ignore une erreur le dit dans son bloc par un commentaire (ESLint `no-empty` refuse un bloc vide). Côté client, un échec se dégrade de façon visible (état d'erreur avec « Réessayer », ou données en cache) et l'écran ne reste jamais figé. Un message d'erreur ne contient jamais de secret (clé API, mot de passe, cookie).

### Types

TypeScript strict avec `noUncheckedIndexedAccess`. `any` est refusé par ESLint. Une réponse d'API externe se type à l'entrée du service (interface + garde ou parsing), une seule fois.

### Budgets

- Rendu serveur d'abord. `'use client'` seulement pour ce qui a de l'état, des événements ou du temps réel, et au plus bas de l'arbre.
- Une seule image Docker, un seul process. Les tâches de fond (poller qBit, poller de disponibilité) s'arrêtent quand personne n'en a besoin.
- Une nouvelle dépendance se justifie dans le message de commit : ce qu'elle apporte que vingt lignes ne feraient pas.

### Portée

Change ce que la tâche demande, plus le nettoyage des lignes que tu touches. Un nettoyage plus large se propose à part.
