import { defineConfig } from "drizzle-kit";

const dbUrl = process.env.NEON_DB_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error("NEON_DB_URL or DATABASE_URL not set. Provide Neon connection string.");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
  },
});
