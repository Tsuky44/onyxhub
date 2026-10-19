# OnyxHub : une seule image, un seul process (le serveur Next en mode standalone).
# Les données (base SQLite, clé de chiffrement) vivent dans /data, à monter en volume.

ARG NODE_VERSION=24

# --- Dépendances : installées seules pour profiter du cache tant que le lockfile ne change pas ---
FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app
# better-sqlite3 est natif : binaire précompilé d'habitude, compilation en secours (arm, nouvelle version de Node).
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
# Si la compilation est nécessaire, elle prend les en-têtes fournis avec Node plutôt que de les télécharger.
ENV npm_config_nodedir=/usr/local
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# --- Build ---
FROM node:${NODE_VERSION}-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# --- Exécution : le serveur standalone, ses fichiers statiques et les migrations ---
FROM node:${NODE_VERSION}-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=4400 \
    HOSTNAME=0.0.0.0 \
    ONYXHUB_DATA_DIR=/data

COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
# Lues au premier accès à la base (lib/db/index.ts) : la base se met à jour toute seule au démarrage.
COPY --from=build --chown=node:node /app/lib/db/migrations ./lib/db/migrations

# Le cache des affiches de next/image (ADR-0007) et les données : deux volumes.
RUN mkdir -p /data /app/.next/cache/images
VOLUME ["/data", "/app/.next/cache/images"]

# Le point d'entrée règle les droits des volumes puis lâche root pour PUID:PGID.
COPY --chmod=755 docker/entrypoint.sh /usr/local/bin/onyxhub-entrypoint
ENTRYPOINT ["onyxhub-entrypoint"]

EXPOSE 4400

# Pas de curl dans l'image slim : Node fait la sonde. /connexion répond sans session.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:4400/connexion').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
