import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./', import.meta.url)) } },
  test: {
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**', '.claude/**'],
    setupFiles: ['./tests/setup.ts'],
    // Chaque test repart d'un `fetch` réel : un mock oublié ne fuit pas dans le suivant.
    unstubGlobals: true,
  },
})
