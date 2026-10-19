import { vi } from 'vitest'

// `server-only` lève hors d'un composant serveur de Next. Sous Vitest, tous
// les modules serveur sont testés directement : on le neutralise une fois ici.
vi.mock('server-only', () => ({}))
