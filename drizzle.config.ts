import { defineConfig } from "drizzle-kit";
import 'dotenv/config';


const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is not set.');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/models/*',
  out: "./drizzle",
  dbCredentials: {
    url: databaseUrl,
  },
  verbose: true,
  strict: true
})
