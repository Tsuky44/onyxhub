/**
 * Démarrage du serveur Next : les tâches de fond qui ne dépendent d'aucune
 * visite. Seul le runtime Node a accès à SQLite et aux services.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { startRequestPoller } = await import('./lib/requests/poller')
  startRequestPoller()
}
