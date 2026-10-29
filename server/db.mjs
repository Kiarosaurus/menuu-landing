import pg from 'pg';

const { Pool } = pg;
let pool;

export function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL. Configura PostgreSQL antes de iniciar Menúu consumidores.');
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: Number(process.env.PGPOOL_MAX || 10) });
    pool.on('error', error => console.error('PostgreSQL: conexión inactiva interrumpida', error));
  }
  return pool;
}

export async function closePool() {
  if (pool) { await pool.end(); pool = undefined; }
}

export async function transaction(work) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
