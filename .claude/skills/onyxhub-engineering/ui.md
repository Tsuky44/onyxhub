# Interface

La direction est celle d'Onyx, **Quiet Premium** : une scène charbon OLED, un accent bleu utilisé avec parcimonie, un mouvement bref. L'affiche du média porte l'émotion, le chrome s'efface.

## Sources de vérité

- `design.md` : la charte d'OnyxHub (reprise de `PROJECT_DESIGN.md` d'Onyx, adaptée au web).
- `PRODUCT.md` : principes produit et accessibilité.
- `app/globals.css` (`@theme`) : les seuls tokens qui existent. Les palettes et l'échelle typographique par défaut de Tailwind sont effacées.
- Pour le savoir-faire UI approfondi (critique, polish, audit, animation, accessibilité) : skills `impeccable`, `tasteful-ui`, `baseline-ui`, `fixing-accessibility`, `fixing-motion-performance`. Passe de finition : `.claude/skills/impeccable/reference/polish.md`.

## Tokens

- Couleurs : `bg`, `surface`, `elevated`, `hover`, `border`, `accent`, `text`, `text-secondary`, `text-muted`, `success`, `warning`, `error`, `rating`, `glass-*`. Aucune couleur en dur dans le code (`tests/guards/design-tokens.test.ts`).
- Texte : les 13 tailles d'AppType (`text-micro` 10 → `text-hero` 40). Aucune taille arbitraire.
- Mouvement : `duration-(--motion-micro|standard|emphasis)` (180 / 200 / 260 ms) et `ease-onyx`, la seule courbe. Sous « réduire les animations », les fondus restent et le géométrique disparaît (règle globale dans `globals.css`).
- Rayons : `rounded-card` (12), `rounded-panel` (16), `rounded-modal` (24).
- Point de rupture du shell : `shell:` (900 px), comme Onyx.
- Une valeur qui manque s'ajoute au `@theme`, avec un commentaire sur son rôle, avant d'être utilisée.

## Composants imposés

| Besoin | Utilise |
|---|---|
| Icône | `@/lib/icons` (Phosphor, entrée `/ssr`), imposé par `tests/guards/icons.test.ts` |
| Titre de page | `PageHeader` |
| Vide | `EmptyState` (chargement et erreur suivront le même langage) |
| Verre | l'utilitaire `glass`, réservé à la nav, aux menus et aux modales |
| Affiche | `next/image` + le helper de poster (phase 3) : bonne taille TMDB, `sizes` juste, ratio fixe |

Un composant utilisé par une deuxième page monte dans `components/ui/`.

## Qualité d'écran

- **Trois états** pour toute donnée asynchrone : chargement (squelette au ratio final), vide, erreur avec une action pour réessayer.
- **Serveur d'abord** : un composant n'est client que s'il a de l'état ou des événements ; on pousse la frontière `'use client'` au plus bas.
- **Accessibilité** : bouton-icône avec `aria-label`, cibles ≥ 44 px sur mobile, focus visible (anneau accent 2 px global), `aria-current` sur l'onglet actif, contraste lisible sur charbon.
- **Textes** : français, en phrases, courts, tutoiement comme Onyx. Un message d'erreur dit ce qui s'est passé et quoi faire.
- **Vérification** : `pnpm dev`, puis la page en largeur téléphone (375 px) et desktop (≥ 1280 px), et sous « réduire les animations » si tu as ajouté du mouvement.
