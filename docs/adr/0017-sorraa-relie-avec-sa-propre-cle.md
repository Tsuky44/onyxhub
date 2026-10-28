# ADR-0017 — sorraa se relie à OnyxHub avec une clé à lui, depuis l'un ou l'autre

- **Statut :** accepté
- **Date :** 2026-10-28
- **Portée :** `lib/integration/sorraa-link.ts`, `resolveSorraaCaller` dans `lib/auth/caller.ts`,
  `app/api/integration/sorraa/*`, la carte sorraa de `app/(app)/reglages/`, `proxy.ts`. Côté
  sorraa : la section « OnyxHub » de ses réglages, sur son API `/hub-link` (son ADR-0021).

## Contexte

sorraa pousse à OnyxHub ses événements et l'avancement de ses téléchargements (son ADR-0021),
à l'adresse et avec la clé enregistrées dans ses propres réglages. Deux choses empêchaient
tout envoi d'arriver :

- aucun écran ne permettait de faire cette liaison : seule l'API de sorraa la connaissait ;
- `proxy.ts` ne laissait pas passer `/api/integration/sorraa/*` sans session.

Les barres de téléchargement restaient donc vides. Pour coller une clé dans sorraa, il fallait
aussi pouvoir la lire. Or la clé d'intégration d'OnyxHub, celle qu'Onyx utilise, ne se
réaffiche jamais. La régénérer pour la recopier aurait coupé Onyx.

## Décision

- **Une clé propre à sorraa**, `sorraa_hub_key`, générée dans la carte sorraa de Réglages et
  montrée une seule fois. Les routes de sorraa l'acceptent, ainsi que la clé d'intégration
  d'Onyx (déjà en place sur les liaisons faites à la main). Les routes d'Onyx, elles, ne
  l'acceptent pas : changer l'une ne touche pas l'autre.
- **« Relier sorraa »** écrit dans sorraa l'adresse d'OnyxHub et cette clé (`PUT /hub-link`, avec
  la clé API de sorraa déjà réglée). La clé est créée si elle manque. OnyxHub fait ensuite tester
  la liaison par sorraa (`POST /hub-link/test`), comme pour « Connecter Onyx » (ADR-0009).
  L'adresse envoyée est `sorraa_hub_url`, sinon `onyxhub_url`, sinon l'origine du navigateur.
- **Depuis sorraa**, la section « OnyxHub » de ses réglages fait la même chose à la main :
  adresse, clé copiée depuis OnyxHub, puis Relier, Tester ou Délier.
- La carte sorraa affiche l'état lu dans sorraa : non relié, relié à une autre adresse, ou dernier
  envoi en échec, avec la raison donnée par sorraa.

## Conséquences

- La liaison se fait d'un clic dans OnyxHub, ou à la main depuis sorraa.
- Régénérer la clé pour sorraa coupe ses envois jusqu'à ce qu'il soit relié de nouveau. La carte
  le dit dès le premier envoi refusé (`lastError`).
