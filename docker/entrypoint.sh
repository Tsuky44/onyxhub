#!/bin/sh
# Démarre OnyxHub sous l'utilisateur PUID:PGID (1000:1000 par défaut, 99:100 sur Unraid),
# après lui avoir donné les dossiers où il écrit : un dossier monté depuis l'hôte
# appartient souvent à root, et SQLite ne pourrait pas y créer sa base.
#
# Certains montages refusent `chown` même à root (NFS, SMB/CIFS, Docker sans root) :
# ce n'est pas une erreur tant que PUID:PGID peut y écrire. Sinon on reste root,
# en le disant, plutôt que de redémarrer en boucle.

PUID="${PUID:-1000}"
PGID="${PGID:-1000}"

as_app() {
  setpriv --reuid="$PUID" --regid="$PGID" --clear-groups "$@"
}

if [ "$(id -u)" = "0" ]; then
  mkdir -p /data /app/.next/cache/images
  for dir in /data /app/.next/cache; do
    as_app test -w "$dir" || chown -R "$PUID:$PGID" "$dir" 2>/dev/null || true
  done

  if as_app test -w /data; then
    exec setpriv --reuid="$PUID" --regid="$PGID" --clear-groups "$@"
  fi

  echo "onyxhub: /data n'est pas accessible en écriture pour $PUID:$PGID et ce montage refuse chown." >&2
  echo "onyxhub: OnyxHub démarre en root. Pour l'éviter, mets PUID/PGID au propriétaire du dossier (ls -ln) ou donne-lui ce dossier sur l'hôte." >&2
fi

exec "$@"
