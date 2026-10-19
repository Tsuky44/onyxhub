import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Une seule image Docker, sans node_modules complet (phase 8).
  output: 'standalone',
  poweredByHeader: false,
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
