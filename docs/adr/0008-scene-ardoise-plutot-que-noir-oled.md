# ADR-0008 — Une scène ardoise plutôt que le noir OLED d'Onyx

- **Statut :** accepté.
- **Date :** 2026-10-20
- **Portée :** `app/globals.css` (fonds, bordure, textes secondaires, `error`, `nav`, `on-primary`), `app/layout.tsx` (`themeColor`), `design.md`.

## Contexte

OnyxHub reprenait le noir OLED d'Onyx (`#0A0A0A`). Il convient au lecteur, où l'image remplit l'écran dans une pièce sombre. Pour les demandes, le calendrier et les téléchargements, on lit des listes et des formulaires : le noir pur paraissait froid et peu accueillant.

## Décision

Contredit ADR-0003 (les tokens sont ceux d'Onyx) pour l'échelle des fonds, parce qu'OnyxHub n'est pas un lecteur :

- Les fonds passent à un charbon éclairci et légèrement bleuté : `bg` `#1C1D22`, `surface` `#25262D`, `elevated` `#2E3038`, `hover` `#383A43`, `border` `#41434D`. La nav de verre et le texte du bouton principal suivent.
- Le texte secondaire et le texte discret s'éclaircissent (`#B0B0B8`, `#9C9CA4`), et `error` passe au rouge clair d'Apple `#FF6961` : sur `elevated` ardoise, `#8E8E93` et `#FF453A` tombaient sous 4,5:1. Le guard test d'ADR-0006 le vérifie.
- L'accent, les états vert et orange, l'or des notes et le reste de la charte ne changent pas.

## Conséquences

- OnyxHub est visiblement plus clair que l'app Onyx, mais garde son langage (verre, accent rationné, affiches au premier plan).
- Revenir au noir, ou aller plus clair, c'est changer ces cinq tokens et relancer le guard de contraste.
