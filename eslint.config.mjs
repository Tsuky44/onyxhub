import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // MediaHub a fini avec 1 017 `any` : on ferme la porte dès le départ.
      '@typescript-eslint/no-explicit-any': 'error',
      // Un catch vide doit dire pourquoi : no-empty accepte un bloc qui ne
      // contient qu'un commentaire, ce qui est exactement la règle voulue.
      'no-empty': ['error', { allowEmptyCatch: false }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  { ignores: ['.next/**', 'node_modules/**', '.claude/**', 'data/**', 'next-env.d.ts'] },
]

export default config
