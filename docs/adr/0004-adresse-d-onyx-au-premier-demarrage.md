# ADR-0004 — L'adresse d'Onyx se donne au premier démarrage, puis seul un admin la change

- **Statut :** accepté. Vérifié contre un serveur Onyx de test (connexion propriétaire et membre, mauvais mot de passe, Onyx arrêté).
- **Date :** 2026-10-19
- **Portée :** `app/connexion/`, `app/(app)/reglages/actions.ts`, `lib/services/onyx/auth.ts`, `lib/settings/registry.ts`.

## Contexte

Les comptes viennent d'Onyx (ADR-0001), donc se connecter suppose de connaître l'adresse d'Onyx. Une variable `ONYX_URL` règle le cas d'un déploiement scripté, mais un premier lancement sans elle laisserait OnyxHub sans aucun moyen d'être configuré : la page Réglages exige un admin, et un admin exige Onyx.

## Décision

- `ONYX_URL`, si elle est définie, gagne toujours ; Réglages l'affiche verrouillée.
- Sinon, tant qu'aucune adresse n'est enregistrée, la page de connexion demande l'adresse en plus des identifiants. Elle n'est enregistrée que si `GET /api/ping` répond comme un serveur Onyx.
- Ensuite, seul un admin la change, dans Réglages, et la nouvelle adresse est testée avant d'être enregistrée. Elle ne peut pas être retirée.

## Conséquences

- Pendant la toute première minute, avant que le propriétaire ne se connecte, quelqu'un sur le réseau pourrait pointer OnyxHub vers un autre serveur Onyx. Le risque est borné (un OnyxHub vide, sans clé ni service branché) et disparaît avec `ONYX_URL`, que `.env.example` et `docker-compose.yml` recommandent.
- Une adresse fausse enregistrée par Réglages est impossible : elle aurait déconnecté tout le monde, admin compris.
