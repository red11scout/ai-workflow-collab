import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "@shared/schema";

function getDatabaseUrl(): string {
  if (process.env.NEON_DB_URL) {
    const url = process.env.NEON_DB_URL.trim();
    if (url.startsWith("postgresql://") || url.startsWith("postgres://")) {
      console.log("Using NEON_DB_URL (external Neon database)");
      return url;
    }
  }

  if (process.env.DATABASE_URL) {
    console.log("Using DATABASE_URL from environment variable");
    return process.env.DATABASE_URL;
  }

  throw new Error(
    "Database URL not configured. Set NEON_DB_URL or DATABASE_URL.",
  );
}

const databaseUrl = getDatabaseUrl();

export const db = drizzle({
  connection: databaseUrl,
  schema,
  ws: ws,
});
