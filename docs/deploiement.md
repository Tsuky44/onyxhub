# Déployer OnyxHub

## Avec l'image publiée (recommandé)

La CI (`.github/workflows/ci.yml`) publie `ghcr.io/<propriétaire>/onyxhub` à chaque push sur `main` (`latest`) et à chaque tag `v1.2.3` (`1.2.3`, `1.2`), pour amd64 et arm64.

```sh
cp .env.example .env      # puis renseigne au moins ONYX_URL
docker compose pull
docker compose up -d
```

OnyxHub répond sur `http://<hôte>:4400`. Le premier compte qui se connecte avec un compte propriétaire d'Onyx configure le reste dans **Réglages**.

Si le paquet GHCR est privé (c'est le cas par défaut à la première publication), soit tu le passes en public dans les réglages du paquet sur GitHub, soit tu te connectes avant de tirer l'image : `docker login ghcr.io` avec un jeton ayant le droit `read:packages`.

## Depuis les sources

```sh
docker compose up -d --build
```

## Données et sauvegarde

- `./data` (monté sur `/data`) contient la base SQLite et `secret.key`. Sauvegarde les deux ensemble : sans la clé, les secrets enregistrés dans Réglages ne se déchiffrent plus.
- Le volume `onyxhub-images` est le cache des affiches (ADR-0007). Il peut être supprimé sans perte.
- `PUID` / `PGID` : l'utilisateur sous lequel tourne OnyxHub, propriétaire de `./data` (Unraid : `99` / `100`).
- Les migrations de la base s'appliquent seules au démarrage.

## Unraid

- Mets les données dans `appdata`, pas en `./data` : avec le plugin Compose Manager, le compose vit sur la clé USB (`/boot`, en FAT32). La base s'y userait, et FAT32 refuse `chown`.
- `PUID=99` et `PGID=100` (`nobody:users`), comme les autres conteneurs.
- L'avertissement `Error parsing config file (/root/.docker/config.json): ... is a directory` vient de Docker sur l'hôte, pas d'OnyxHub. Il est sans effet.

```yaml
services:
  onyxhub:
    image: ghcr.io/tsuky44/onyxhub:latest
    container_name: onyxhub
    restart: unless-stopped
    ports:
      - "4400:4400"
    environment:
      PUID: "99"
      PGID: "100"
      TZ: "Europe/Paris"
    volumes:
      - /mnt/user/appdata/onyxhub:/data
      - /mnt/user/appdata/onyxhub/cache-images:/app/.next/cache/images
```

Si le dossier monté refuse `chown` (partage NFS ou SMB, par exemple), OnyxHub démarre quand même et le signale dans ses journaux : il tourne alors en root tant que `/data` n'est pas accessible en écriture pour `PUID:PGID`.

## Brancher Onyx

Dans les réglages d'Onyx, mets l'adresse d'OnyxHub dans « Adresse MediaHub » et la clé d'intégration générée dans Réglages d'OnyxHub dans « Clé API MediaHub » (ADR-0002).

## Publier une version

```sh
git tag v1.0.0
git push origin v1.0.0
```
