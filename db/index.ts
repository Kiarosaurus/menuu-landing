import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

let dbInstance: ReturnType<typeof drizzle> | null = null;
let initPromise: Promise<void> | null = null;

export function getDb() {
  if (dbInstance) return dbInstance;

  const url =
    process.env.TURSO_DATABASE_URL ||
    process.env.DATABASE_URL ||
    "file:local.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;

  const client = createClient({
    url,
    authToken,
  });

  if (!initPromise) {
    initPromise = client
      .executeMultiple(
        `
      CREATE TABLE IF NOT EXISTS \`leads\` (
        \`email\` text PRIMARY KEY NOT NULL,
        \`created_at\` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        \`consent_version\` text DEFAULT 'pilot-v1' NOT NULL,
        \`edit_token_hash\` text,
        \`edit_token_expires_at\` text
      );
    `
      )
      .then(() => {})
      .catch((err) => {
        // Ignorar errores si las columnas ya existen en el ALTER TABLE
        console.warn("Ensure leads table existence info:", err);
      });
  }

  dbInstance = drizzle(client, { schema });

  return dbInstance;
}
