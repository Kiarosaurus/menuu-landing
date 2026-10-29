import { closePool } from '../server/db.mjs';
import { seedDemo } from '../server/seed.mjs';
import { migrate } from './migrate.mjs';

try {
  await migrate();
  await seedDemo();
  console.log('Datos de prueba cargados en PostgreSQL.');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await closePool();
}
