# OnyxHub

Compagnon web d'**Onyx** (serveur média Go + app Flutter, dans `../project playeur`) : demandes de médias (TMDB → Radarr/Sonarr), calendrier des sorties, téléchargements (qBittorrent, Prowlarr, SMB). Remplace `../mediahub`, jugé trop lourd. Next.js 16 (App Router) + TypeScript strict + Tailwind v4 + SQLite (Drizzle). Le plan, les décisions et les phases sont dans `PLAN.md`.

## Communication : travail silencieux, récap final

Pendant une tâche, travaille en silence : enchaîne lectures, modifications et commandes sans commenter chaque action. Le seul message en cours de route est une question bloquante, c'est-à-dire une décision qui revient à l'utilisateur. Si l'utilisateur demande de détailler ce que tu fais, commente alors au fil de l'eau jusqu'à la fin de cette tâche.

À la fin, un seul **récap** court :
- **Fait** : ce qui a été implémenté, avec les fichiers clés en liens.
- **Vérifié** : les commandes lancées et leur résultat (vert/rouge).
- **À savoir** : les échecs, les étapes sautées, les décisions prises et ce qui reste à faire. Omets cette partie si elle est vide.

## Économie de tokens

- Pour trouver une fonction, un symbole ou la structure d'un fichier, utilise le skill `smart-explore` (AST) au lieu de lire le fichier entier.
- Pour une question d'architecture, interroge d'abord le graphe `graphify-out/` (`/graphify query`) s'il existe. Pour MediaHub, son graphe est dans `../mediahub/next-app/graphify-out/`.
- Ne lis jamais `.next/`, `node_modules/`, `data/`. Ces dossiers sont refusés dans `.claude/settings.json`.

## Commandes

- `pnpm dev` : serveur de dev sur http://localhost:4400
- `pnpm check` : ESLint + `tsc --noEmit` + Vitest (guard tests compris). Doit être vert avant chaque commit.
- `pnpm build` : jamais pendant que `pnpm dev` tourne. Les deux écrivent dans `.next/`, et le serveur de dev se met alors à servir des modules périmés. Arrête le dev, build, puis supprime `.next/`.
- `pnpm db:generate` : nouvelle migration après un changement de `lib/db/schema.ts`.

## Agent skills

### Standards de code

Pour tout code de ce dépôt, charge le skill `onyxhub-engineering` (`.claude/skills/onyxhub-engineering/`).

### Domain docs

Single-context : un `CONTEXT.md` (créé au besoin) + `docs/adr/` à la racine. Voir `docs/agents/domain.md`.
