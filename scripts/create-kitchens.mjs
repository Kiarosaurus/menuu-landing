import { randomBytes, randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { closeDb, transaction } from '../server/db.mjs';
import { hashPassword } from '../server/store.mjs';
import { migrate } from './migrate.mjs';

const url = process.env.TURSO_DATABASE_URL;
if (!url?.startsWith('libsql://') || !process.env.TURSO_AUTH_TOKEN) {
  console.error('Configura TURSO_DATABASE_URL (libsql://...) y TURSO_AUTH_TOKEN de la base remota de consumidores.');
  process.exit(1);
}

const terminal = createInterface({ input: stdin, output: stdout });
const slug = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function ask(label, valid, hint) {
  while (true) {
    const value = (await terminal.question(label)).trim();
    if (valid(value)) return value;
    console.log(hint);
  }
}

try {
  const database = new URL(url);
  console.log(`Base remota: ${database.host}${database.pathname}`);
  console.log('Se crearán dos cocinas y sus cuentas de acceso en esta base.');
  const kitchens = [];
  for (let number = 1; number <= 2; number++) {
    console.log(`\nCocina ${number} de 2`);
    const name = await ask('Nombre (2–40 caracteres): ', value => value.length >= 2 && value.length <= 40 && Boolean(slug(value)), 'Escribe un nombre de 2 a 40 caracteres con letras o números.');
    const email = (await ask('Correo de acceso: ', value => emailPattern.test(value), 'Escribe un correo válido.')).toLowerCase();
    const description = await ask('Descripción breve (opcional, máximo 70 caracteres): ', value => value.length <= 70, 'La descripción admite hasta 70 caracteres.');
    kitchens.push({ id: slug(name), name, email, description, password: randomBytes(18).toString('base64url') });
  }
  if (kitchens[0].id === kitchens[1].id || kitchens[0].email === kitchens[1].email) {
    throw new Error('Las dos cocinas necesitan nombres e identificadores de correo distintos.');
  }
  const confirmation = await terminal.question('\nEscribe CREAR para guardar ambas cocinas: ');
  if (confirmation.trim() !== 'CREAR') {
    console.log('Operación cancelada; no se guardó ninguna cocina.');
  } else {
    await migrate();
    await transaction(async db => {
      for (const kitchen of kitchens) {
        if ((await db.query('SELECT 1 FROM kitchens WHERE id=$1', [kitchen.id])).rowCount) {
          throw new Error(`Ya existe una cocina con identificador «${kitchen.id}».`);
        }
        if ((await db.query('SELECT 1 FROM users WHERE email=$1', [kitchen.email])).rowCount) {
          throw new Error(`El correo «${kitchen.email}» ya tiene una cuenta.`);
        }
        await db.query('INSERT INTO kitchens (id, name, description) VALUES ($1, $2, $3)', [kitchen.id, kitchen.name, kitchen.description]);
        await db.query("INSERT INTO users (id, name, email, password_hash, role, kitchen_id) VALUES ($1, $2, $3, $4, 'kitchen', $5)",
          [randomUUID(), kitchen.name, kitchen.email, hashPassword(kitchen.password), kitchen.id]);
      }
    });
    console.log('\nCocinas creadas. Guarda estas contraseñas ahora; no volverán a mostrarse:');
    for (const kitchen of kitchens) console.log(`${kitchen.name} (${kitchen.id})\n  Correo: ${kitchen.email}\n  Contraseña: ${kitchen.password}`);
    console.log('Cada cocina puede iniciar sesión en #cocina y subir su foto en Mi cocina.');
  }
} catch (error) {
  console.error(`No se crearon las cocinas: ${error.message}`);
  process.exitCode = 1;
} finally {
  terminal.close();
  await closeDb();
}
