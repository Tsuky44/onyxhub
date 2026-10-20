# Design — Quiet Premium, version web

Repris de `PROJECT_DESIGN.md` d'Onyx (`../project playeur`), qui reste la référence en cas de doute. Les tokens vivent dans `app/globals.css` (ADR-0003).

## Thèse

Une scène ardoise (charbon éclairci, ADR-0008), des affiches pour seul spectacle, du verre seulement là où il sert (nav, menus, modales). Calme, confiance, jamais flashy.

Poids visuel : 1) affiche 2) titre et statut 3) navigation 4) chrome décoratif (quasi zéro).

## Couleurs

| Rôle | Token | Valeur |
|---|---|---|
| Fond | `bg` | `#1C1D22` (≠ Onyx `#0A0A0A`, ADR-0008) |
| Surface | `surface` | `#25262D` |
| Surface élevée | `elevated` | `#2E3038` |
| Survol | `hover` | `#383A43` |
| Bordure | `border` / `glass-border` | `#41434D` / blanc 8 % |
| Accent (focus, sélection, progression, liens) | `accent` | `#0A84FF`, ≤ 5 % de la surface |
| Texte | `text` / `text-secondary` / `text-muted` | `#F5F5F7` / `#B0B0B8` / `#9C9CA4` (≠ Onyx, ADR-0006 et ADR-0008) |
| États | `success` / `warning` / `error` | `#30D158` / `#FF9F0A` / `#FF6961` |
| Étoiles des notes | `rating` | `#F5C518`, rien d'autre |

Interdits : le rouge `#E50914`, les dégradés violets, le néon.

## Typographie

- **Manrope** pour l'interface et les titres (700 et tracking −0,02 em sur les grands titres, 600 pour les sections, 400 pour le texte).
- **Geist Mono** pour les badges (4K, HDR, ADMIN), les compteurs et les chiffres alignés.
- Les 13 tailles d'AppType : 10 · 11 · 12 · 13 · 14 · 15 · 17 · 20 · 22 · 24 · 28 · 34 · 40 (`text-micro` → `text-hero`).

## Composants

- **Boutons** : principal en blanc 92 % avec texte presque noir, rayon 12 ; secondaire en verre ou liseré blanc 12 %.
- **Cartes d'affiche** : rayon 12, pas de fond derrière l'affiche ; survol desktop = liseré blanc 16 % et légère luminosité ; progression en barre accent de 3–4 px en bas.
- **Navigation** : header de verre (flou ~28 px), onglet affiché en gras avec un trait blanc court dessous ; barre du bas mobile avec icône pleine et libellé blanc pour l'onglet affiché.
- **Vide, chargement, erreur** : texte centré et calme, spinner accent, pas d'illustration.

## Mise en page

- Espacements : 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64.
- Marges : 20 px mobile, 48 px dès 900 px, 80 px sur grand écran. Contenu limité à 1 440 px.
- Point de rupture du shell : 900 px (`shell:`).

## Profondeur et mouvement

- Plat → verre niveau 1 (nav) → verre niveau 2 (menus, modales). Une seule ombre, pour ce qui flotte : `0 24px 48px` noir 45 %.
- 180 / 200 / 260 ms, une seule courbe ease-out. Fondus gardés sous « réduire les animations », mouvements coupés.
