#!/bin/sh
# Démarre OnyxHub sous l'utilisateur PUID:PGID (1000:1000 par défaut, 99:100 sur Unraid),
# après lui avoir donné les dossiers où il écrit : un dossier monté depuis l'hôte
# appartient souvent à root, et SQLite ne pourrait pas y créer sa base.
set -e

PUID="${PUID:-1000}"
PGID="${PGID:-1000}"

if [ "$(id -u)" = "0" ]; then
  mkdir -p /data /app/.next/cache/images
  chown -R "$PUID:$PGID" /data /app/.next/cache
  exec setpriv --reuid="$PUID" --regid="$PGID" --clear-groups "$@"
fi

# Lancé directement sous un autre utilisateur (`user:` dans compose) : rien à changer.
exec "$@"
