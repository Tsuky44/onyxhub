import { defineConfig } from 'drizzle-kit'

// `pnpm db:generate` écrit une migration SQL dans lib/db/migrations à partir
// du schéma. Une migration publiée ne se modifie jamais.
export default defineConfig({
  dialect: 'sqlite',
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
})
