/**
 * La liste des réglages : quels services, quels champs, lesquels sont
 * secrets. Ce fichier ne contient aucune valeur, il est donc lisible côté
 * client (le formulaire de Réglages s'en sert pour se construire).
 */

export type FieldKind = 'url' | 'text' | 'secret' | 'number'

export interface SettingField {
  key: string
  label: string
  kind: FieldKind
  placeholder?: string
  help?: string
  /** Variable d'environnement prioritaire sur la base : le champ s'affiche alors verrouillé. */
  env?: string
  /** Valeur utilisée quand rien n'est enregistré. */
  fallback?: string
  /** Le service fonctionne sans (qBit qui dispense ce réseau d'authentification, partage SMB invité…). */
  optional?: boolean
  /** Bornes d'un champ `number`. */
  min?: number
  max?: number
}

export interface ServiceDefinition {
  id: string
  label: string
  description: string
  fields: readonly SettingField[]
  /** Le bouton « Tester » existe (un service sans test le dit dans sa description). */
  testable: boolean
  /** Le secret que le bouton « Générer » remplit (clé d'intégration, secret des webhooks). */
  generates?: string
  /** Le bouton « Connecter Onyx » écrit ces réglages dans Onyx (ADR-0009). */
  linksOnyx?: boolean
}

export const SERVICES = [
  {
    id: 'onyx',
    label: 'Onyx',
    description: 'Le serveur dont OnyxHub utilise les comptes, les permissions et les statistiques.',
    testable: true,
    fields: [{ key: 'onyx_url', label: 'URL du serveur', kind: 'url', placeholder: 'http://192.168.1.10:8080', env: 'ONYX_URL' }],
  },
  {
    id: 'integration',
    label: 'Liaison avec Onyx',
    description:
      'Le serveur Onyx joint OnyxHub avec cette adresse et cette clé pour envoyer les demandes faites dans l\'app et afficher les disponibilités. « Connecter Onyx » les écrit dans les réglages d\'Onyx, puis vérifie qu\'Onyx joint bien OnyxHub.',
    testable: false,
    generates: 'integration_api_key',
    linksOnyx: true,
    fields: [
      {
        key: 'onyxhub_url',
        label: 'Adresse d\'OnyxHub vue par Onyx',
        kind: 'url',
        optional: true,
        env: 'ONYXHUB_URL',
        placeholder: 'http://192.168.1.10:4400',
        help: 'Vide : l\'adresse de ce navigateur. À remplir si Onyx joint OnyxHub autrement (nom Docker, réseau interne).',
      },
      { key: 'integration_api_key', label: 'Clé', kind: 'secret', env: 'ONYXHUB_INTEGRATION_KEY', help: 'Créée par « Connecter Onyx » si elle manque.' },
    ],
  },
  {
    id: 'webhooks',
    label: 'Webhooks Radarr et Sonarr',
    description:
      "Font avancer les demandes dès qu'une release est saisie ou importée. Dans Radarr et Sonarr, Réglages → Connexions → Webhook, URL : adresse d'OnyxHub suivie de /api/webhooks/radarr?secret=… (ou /sonarr), événements « À la saisie », « À l'import » et « À la mise à niveau ». Sans webhook, les statuts se mettent à jour toutes les 5 minutes.",
    testable: false,
    generates: 'webhook_secret',
    fields: [{ key: 'webhook_secret', label: 'Secret', kind: 'secret' }],
  },
  {
    id: 'tmdb',
    label: 'TMDB',
    description: 'Catalogue, fiches et affiches des films et séries.',
    testable: true,
    fields: [{ key: 'tmdb_api_key', label: 'Clé API (v3) ou jeton d\'accès (v4)', kind: 'secret' }],
  },
  {
    id: 'radarr',
    label: 'Radarr',
    description: 'Reçoit les demandes de films.',
    testable: true,
    fields: [
      { key: 'radarr_url', label: 'URL', kind: 'url', placeholder: 'http://192.168.1.10:7878' },
      { key: 'radarr_api_key', label: 'Clé API', kind: 'secret' },
    ],
  },
  {
    id: 'sonarr',
    label: 'Sonarr',
    description: 'Reçoit les demandes de séries, saison par saison.',
    testable: true,
    fields: [
      { key: 'sonarr_url', label: 'URL', kind: 'url', placeholder: 'http://192.168.1.10:8989' },
      { key: 'sonarr_api_key', label: 'Clé API', kind: 'secret' },
    ],
  },
  {
    id: 'qbittorrent',
    label: 'qBittorrent',
    description: 'Le client de téléchargement suivi dans Téléchargements.',
    testable: true,
    fields: [
      { key: 'qbittorrent_url', label: 'URL de l\'interface web', kind: 'url', placeholder: 'http://192.168.1.10:8081' },
      { key: 'qbittorrent_username', label: 'Utilisateur', kind: 'text', optional: true },
      { key: 'qbittorrent_password', label: 'Mot de passe', kind: 'secret', optional: true },
      {
        key: 'qbittorrent_poll_interval',
        label: 'Rafraîchissement (secondes)',
        kind: 'number',
        optional: true,
        fallback: '5',
        min: 2,
        max: 60,
        help: 'Toutes les combien de secondes la liste se met à jour quand quelqu\'un la regarde. 2 s minimum.',
      },
    ],
  },
  {
    id: 'prowlarr',
    label: 'Prowlarr',
    description: 'Recherche de releases sur tes indexeurs.',
    testable: true,
    fields: [
      { key: 'prowlarr_url', label: 'URL', kind: 'url', placeholder: 'http://192.168.1.10:9696' },
      { key: 'prowlarr_api_key', label: 'Clé API', kind: 'secret' },
    ],
  },
  {
    id: 'smb',
    label: 'Partage SMB',
    description: 'Le gestionnaire de fichiers de Téléchargements : parcourir, télécharger, supprimer et partager par lien.',
    testable: true,
    fields: [
      { key: 'smb_host', label: 'Hôte', kind: 'text', placeholder: '192.168.1.10' },
      { key: 'smb_share', label: 'Partage', kind: 'text', placeholder: 'data' },
      { key: 'smb_username', label: 'Utilisateur', kind: 'text', optional: true },
      { key: 'smb_password', label: 'Mot de passe', kind: 'secret', optional: true },
      { key: 'smb_root_path', label: 'Dossier racine', kind: 'text', optional: true, placeholder: 'downloads' },
    ],
  },
] as const satisfies readonly ServiceDefinition[]

export type ServiceId = (typeof SERVICES)[number]['id']
export type SettingKey = (typeof SERVICES)[number]['fields'][number]['key']

export function findService(id: string): ServiceDefinition | undefined {
  return SERVICES.find((service) => service.id === id)
}

export function findField(key: string): SettingField | undefined {
  for (const service of SERVICES) {
    const field = (service.fields as readonly SettingField[]).find((candidate) => candidate.key === key)
    if (field) return field
  }
  return undefined
}
