import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { closeDb, getDb } from "../server/db.mjs";

const SCHEMA_FILE = "0000_sqlite_schema.sql";

export async function migrate() {
  const db = getDb();

  // Enable WAL mode and foreign keys for every connection
  await db.executeMultiple("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");

  // Ensure the migrations table exists
  await db.execute(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))",
  );

  const schemaPath = fileURLToPath(
    new URL("../server/migrations/" + SCHEMA_FILE, import.meta.url),
  );
  const sql = await readFile(schemaPath, "utf8");

  const already = await db.execute(
    "SELECT 1 FROM schema_migrations WHERE name = ?",
    [SCHEMA_FILE],
  );
  if (!already.rows.length) {
    // Apply the full consolidated schema. executeMultiple runs each statement individually.
    await db.executeMultiple(sql);
    await db.execute("INSERT INTO schema_migrations (name) VALUES (?)", [
      SCHEMA_FILE,
    ]);
    console.log(`Migración aplicada: ${SCHEMA_FILE}`);
  }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  try {
    await migrate();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
}
