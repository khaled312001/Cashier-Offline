import { defineConfig } from 'drizzle-kit'

// drizzle-kit generates SQL migrations from the schema files.
// The actual DB file lives in the app's userData dir at runtime; for migration
// generation we only need the schema definitions, not a live DB.
export default defineConfig({
  dialect: 'sqlite',
  schema: './db/schema/index.ts',
  out: './db/migrations',
  verbose: true,
  strict: true
})
