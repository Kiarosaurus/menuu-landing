import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { closePool, getPool } from '../server/db.mjs';

export async function migrate() {
  const client = await getPool().connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext('menuu_consumer_migrations')::bigint)");
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const directory = fileURLToPath(new URL('../server/migrations/', import.meta.url));
    for (const name of (await readdir(directory)).filter(value => value.endsWith('.sql')).sort()) {
      if ((await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [name])).rowCount) continue;
      const sql = await readFile(join(directory, name), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      console.log(`Migración aplicada: ${name}`);
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext('menuu_consumer_migrations')::bigint)").catch(() => {});
    client.release();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try { await migrate(); } catch (error) { console.error(error); process.exitCode = 1; }
  finally { await closePool(); }
}
