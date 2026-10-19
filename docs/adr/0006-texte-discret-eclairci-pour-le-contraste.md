# ADR-0006 — Le texte discret est éclairci pour tenir le contraste AA

- **Statut :** accepté.
- **Date :** 2026-10-19
- **Portée :** `app/globals.css` (`--color-text-muted`), `design.md`, `tests/guards/accessibility.test.ts`.

## Contexte

`text-muted` reprend `AppColors.textMuted` d'Onyx, `#6E6E73`. Sur les fonds charbon il ne donne que 3,9:1 (fond), 3,6:1 (surface) et 3,4:1 (élevé), sous le seuil WCAG AA de 4,5:1 pour du texte courant. OnyxHub l'utilise pour des informations réelles (dates, tailles, compteurs), pas seulement pour de la décoration. PRODUCT.md demande un « contraste lisible sur charbon ».

## Décision

Contredit ADR-0003 (les tokens sont ceux d'Onyx) pour ce seul token, parce que la règle d'accessibilité de PRODUCT.md passe avant la parité exacte :

- `--color-text-muted` passe à `#8E8E93`, le gris système d'Apple (5,2 à 6,1:1 sur les fonds charbon). La hiérarchie texte / secondaire / discret reste lisible (`#F5F5F7`, `#A1A1A6`, `#8E8E93`).
- Le jour courant du calendrier passe d'un rond accent à texte blanc (3,9:1) à un rond `accent-muted` à texte charbon (9:1).
- Un guard test calcule le contraste de chaque couleur de texte sur `bg`, `surface` et `elevated`, et échoue sous 4,5:1.

## Conséquences

- Le texte discret d'OnyxHub est un peu plus clair que celui de l'app Onyx. À proposer à Onyx, qui a le même écart.
- Un nouveau token de texte entre dans la liste du guard test.
