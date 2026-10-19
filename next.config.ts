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
    remotePatterns: [{ protocol: 'https', hostname: 'image.tmdb.org' }],
  },
}

export default nextConfig
