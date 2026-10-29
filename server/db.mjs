import { createClient } from "@libsql/client";

let client;

export function getDb() {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (url && authToken) {
      // Remote Turso DB
      client = createClient({ url, authToken });
    } else if (url) {
      // Local libSQL file or in-memory (no auth needed)
      client = createClient({ url });
    } else {
      // Fallback: local SQLite file
      client = createClient({ url: "file:local.db" });
    }
  }
  return client;
}

export async function closeDb() {
  if (client) {
    client.close();
    client = undefined;
  }
}

/**
 * Run a series of statements as an explicit transaction.
 * `work` receives a thin transaction-like object with an `execute(sql, args)` method.
 * Statements are batched where possible for performance.
 */
export async function transaction(work) {
  const db = getDb();
  const tx = await db.transaction("write");
  try {
    const result = await work(tx);
    await tx.commit();
    return result;
  } catch (error) {
    await tx.rollback().catch(() => {});
    throw error;
  }
}
