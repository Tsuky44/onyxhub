import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Une seule image Docker, sans node_modules complet (phase 8).
  output: 'standalone',
  poweredByHeader: false,
  // Les fichiers .torrent passent par une server action : 1 Mo par défaut ne suffit pas à un gros pack.
  experimental: { serverActions: { bodySizeLimit: '10mb' } },
  // Le client SMB charge ses modules à l'exécution : on le laisse hors du bundle.
  serverExternalPackages: ['@marsaud/smb2', 'archiver'],
  images: {
    // Repris de MediaHub : AVIF puis WebP, et un cache d'un an, puisqu'une
    // affiche TMDB ne change jamais à chemin égal.
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31_536_000,
    // TMDB pour tout le catalogue ; fanart.tv pour les affiches choisies dans Onyx (lectures en cours).
    remotePatterns: [
      { protocol: 'https', hostname: 'image.tmdb.org' },
      { protocol: 'https', hostname: 'assets.fanart.tv' },
    ],
  },
}

export default nextConfig
