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

## Brancher Onyx

Dans les réglages d'Onyx, mets l'adresse d'OnyxHub dans « Adresse MediaHub » et la clé d'intégration générée dans Réglages d'OnyxHub dans « Clé API MediaHub » (ADR-0002).

## Publier une version

```sh
git tag v1.0.0
git push origin v1.0.0
```
