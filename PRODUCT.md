# Product

## Platform

Web adaptatif (desktop et mobile), en compagnon de l'app Onyx.

## Users

- **Membre** d'un serveur Onyx : demande un film ou une série manquant, suit ses demandes, regarde ce qui sort bientôt.
- **Admin** (propriétaire ou `manage_settings`) : suit l'état du serveur, traite les demandes, pilote les téléchargements.

## Product Purpose

OnyxHub remplace MediaHub pour un seul serveur média, Onyx. Il garde ce qui servait vraiment (demandes, calendrier, téléchargements) et laisse tomber le reste (Emby/Jellyfin/Plex, Docker, support, comptes en double). Succès = demander un média en trois gestes, savoir où il en est sans demander à l'admin, et que l'admin voie l'état du serveur d'un coup d'œil.

## Operating Context

- Navigation : Accueil · Demandes · Calendrier, plus Téléchargements · Réglages pour l'admin. Header de verre au-delà de 900 px, barre du bas en deçà.
- Comptes et permissions : ceux d'Onyx (voir ADR-0001).
- Les demandes faites depuis l'app Onyx arrivent ici par le même contrat que MediaHub (ADR-0002).

## Product Principles

1. Le contenu est le héros ; le chrome s'efface.
2. Une demande se fait en trois gestes, et son état se lit sans chercher.
3. Densité et lisibilité des listes avant la décoration.
4. Une seule identité visuelle avec Onyx : même charte, mêmes mots.
5. Rien de ce que MediaHub faisait d'utile sur ces pages ne disparaît.

## Accessibility & Inclusion

Contraste lisible sur charbon, cibles tactiles ≥ 44 px sur mobile, focus clavier visible partout, `prefers-reduced-motion` respecté (fondus gardés, mouvements géométriques coupés).
