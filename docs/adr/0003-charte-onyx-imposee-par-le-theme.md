# ADR-0003 — La charte d'Onyx imposée par le thème Tailwind

- **Statut :** accepté.
- **Date :** 2026-10-19
- **Portée :** `app/globals.css`, `lib/icons.ts`, `tests/guards/design-tokens.test.ts`, `tests/guards/icons.test.ts`.

## Contexte

L'interface reprend la direction Quiet Premium d'Onyx (`PROJECT_DESIGN.md` d'Onyx) : couleurs d'`AppColors`, treize tailles d'`AppType`, durées d'`AppMotion` (180–280 ms, une seule courbe), icônes Phosphor. Dans Onyx, ces règles tiennent par des guard tests. MediaHub, lui, mélangeait trois thèmes (`globals.css`, `interface.css`, `themes.css`), les couleurs Tailwind par défaut, lucide-react et heroicons.

## Décision

- Le `@theme` de `app/globals.css` **efface** les palettes et l'échelle typographique par défaut de Tailwind (`--color-*: initial`, `--text-*: initial`) et ne déclare que les tokens d'Onyx. Une classe hors charte (`bg-blue-500`, `text-lg`) ne génère tout simplement aucun style.
- Les durées passent par des variables `--motion-*` (`duration-(--motion-standard)`).
- Des guard tests refusent ce que le thème ne peut pas empêcher : couleur en dur, taille de texte arbitraire, durée en dur, icône importée hors de `lib/icons.ts`.
- Polices embarquées (Fontsource : Manrope, Geist Mono), comme l'app Onyx qui démarre hors ligne (ADR-0025 d'Onyx).

## Conséquences

- Ajouter une couleur ou une taille, c'est l'ajouter au `@theme` avec son rôle, donc une décision visible en relecture.
- Une classe Tailwind par défaut tapée par habitude ne produit rien : l'erreur se voit à l'écran, pas en production des mois plus tard.
- `viewport.themeColor` (dans `app/layout.tsx`) reste en dur : le navigateur le lit avant tout CSS. C'est la seule exception, listée dans le guard test.
