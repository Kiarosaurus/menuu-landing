import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, rmdir, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { selectCustomization } from '../server/customization.mjs';
import { hashPassword } from '../server/store.mjs';

const baseUrl = process.env.TEST_DATABASE_URL;
if (!baseUrl) throw new Error('Configura TEST_DATABASE_URL con una base PostgreSQL de pruebas.');
const admin = new pg.Client({ connectionString: baseUrl });
const schema = `menuu_smoke_${randomBytes(6).toString('hex')}`;
const url = new URL(baseUrl);
url.searchParams.set('options', `-c search_path=${schema}`);
const databaseUrl = url.toString();
const base = 'http://127.0.0.1:4175';
let server;
let stderr = '';

function assert(condition, message) { if (!condition) throw new Error(message); }

async function request(path, options) {
  const response = await fetch(`${base}${path}`, options);
  return { response, data: response.headers.get('content-type')?.includes('application/json') ? await response.json() : null };
}

function startServer() {
  stderr = '';
  server = spawn(process.execPath, ['server/index.mjs', '--seed-demo'], {
    cwd: process.cwd(), env: { ...process.env, PORT: '4175', DATABASE_URL: databaseUrl }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stderr.on('data', chunk => { stderr += chunk.toString(); });
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try { return await request('/api/bootstrap'); } catch { await new Promise(resolve => setTimeout(resolve, 250)); }
  }
  throw new Error(`Servidor no disponible: ${stderr}`);
}

async function stopServer() {
  if (server?.exitCode === null) {
    server.kill();
    await new Promise(resolve => server.once('exit', resolve));
  }
  server = undefined;
}

await admin.connect();
try {
  await admin.query(`CREATE SCHEMA "${schema}"`);
  startServer();
  const initial = await waitForServer();
  assert(initial.response.status === 200, `No carga el catálogo: ${JSON.stringify(initial.data)}`);
  assert(initial.data.catalog.weeks.length === 2, 'Faltan las dos semanas');
  assert(initial.data.catalog.kitchens.length === 3, 'Faltan las tres cocinas');
  assert(initial.data.careers.length === 16, 'Falta la lista de carreras UTEC');
  assert(initial.data.catalog.kitchens.every(kitchen => kitchen.logoUrl), 'Faltan logos de cocina');
  assert(initial.data.catalog.kitchens.every(kitchen => kitchen.rating === null && kitchen.ratingCount === 0), 'Se inventaron puntuaciones de cocina');
  assert(initial.data.catalog.offerings.length === 18, 'Las cocinas no publicaron los menús esperados');
  assert(initial.data.catalog.sales.length === 0, 'Se inventaron ventas antes de reservar');
  assert(initial.data.catalog.weeklyDishSales.length === 0, 'Se inventaron platos populares antes de reservar');
  assert(initial.data.catalog.offerings.every(offer => offer.deliveryTime === '13:00' && offer.pickupUntil === '13:10'), 'El recojo no es de 1:00 a 1:10 p.m.');
  assert(initial.data.catalog.offerings.every(offer => offer.bookingDeadline && new Date(offer.bookingDeadline) < new Date(`${offer.date}T${offer.deliveryTime}:00-05:00`)), 'Falta un cierre de reserva anterior al recojo');
  assert(initial.data.catalog.offerings.some(offer => new Date(`${offer.date}T${offer.deliveryTime}:00-05:00`).getTime() - new Date(offer.bookingDeadline).getTime() === 2 * 24 * 60 * 60_000), 'La cocina de prueba no tiene un cierre de reserva dos días antes');
  const descriptionClient = new pg.Client({ connectionString: databaseUrl });
  await descriptionClient.connect();
  try {
    let rejected = false;
    try {
      await descriptionClient.query('UPDATE dishes SET description=$1 WHERE kitchen_id=$2 AND id=$3', ['x'.repeat(91), initial.data.catalog.offerings[0].kitchenId, initial.data.catalog.offerings[0].dishId]);
    } catch (error) { rejected = error.code === '23514'; }
    assert(rejected, 'PostgreSQL aceptó una descripción de plato de más de 90 caracteres');
    let invalidStudentCodeRejected = false;
    try {
      await descriptionClient.query('UPDATE users SET student_code=$1 WHERE id=$2', ['ABC1234', 'estudiante-demo']);
    } catch (error) { invalidStudentCodeRejected = error.code === '23514'; }
    assert(invalidStudentCodeRejected, 'PostgreSQL aceptó letras en un código de estudiante');
    let shortStudentCodeRejected = false;
    try {
      await descriptionClient.query('UPDATE users SET student_code=$1 WHERE id=$2', ['12345678', 'estudiante-demo']);
    } catch (error) { shortStudentCodeRejected = error.code === '23514'; }
    assert(shortStudentCodeRejected, 'PostgreSQL aceptó un código de estudiante de 8 dígitos');
  } finally { await descriptionClient.end(); }
  const extras = initial.data.catalog.offerings.flatMap(offer => offer.customization).find(group => group.selectionType === 'multiple');
  assert(extras?.maxSelections === 2, 'Las opciones múltiples no salieron de PostgreSQL');
  for (const path of ['/images/chaufa-wok.webp', '/images/lomo-saltado.webp', '/images/aji-de-gallina.webp']) {
    const image = await request(path);
    assert(image.response.status === 200 && image.response.headers.get('content-type')?.startsWith('image/'), `No carga la foto ${path}`);
  }
  for (const kitchen of initial.data.catalog.kitchens) {
    const logo = await request(kitchen.logoUrl);
    assert(logo.response.status === 200, `No carga el logo de ${kitchen.name}`);
  }

  const external = await request('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Fuera UTEC', email: 'fuera@example.com', password: 'ContrasenaDePrueba123' }) });
  assert(external.response.status === 400, 'El registro acepta dominios ajenos a UTEC');
  const registration = { name: 'Nuevo Estudiante', email: 'nuevo.estudiante@utec.edu.pe', studentCode: '202600001', career: 'Ciencia de la Computación', birthDate: '2004-06-12', password: 'ContrasenaDePrueba123' };
  const missingDetails = await request('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: registration.name, email: registration.email, password: registration.password }) });
  assert(missingDetails.response.status === 400, 'El registro acepta estudiantes sin código ni carrera');
  const wrongCareer = await request('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...registration, career: 'Carrera inventada' }) });
  assert(wrongCareer.response.status === 400, 'El registro acepta una carrera fuera de la lista');
  const wrongCode = await request('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...registration, studentCode: '2026-001' }) });
  assert(wrongCode.response.status === 400, 'El registro acepta guiones en el código de estudiante');
  const shortCode = await request('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...registration, studentCode: '20260001' }) });
  assert(shortCode.response.status === 400, 'El registro acepta códigos de 8 dígitos');
  const registered = await request('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(registration) });
  assert(registered.response.status === 201 && registered.data.user.studentCode === registration.studentCode && registered.data.user.career === registration.career && registered.data.user.birthDate === registration.birthDate, 'No guarda los datos del estudiante');
  const registrationCookie = registered.response.headers.get('set-cookie')?.split(';')[0];
  const registeredSession = registrationCookie && await request('/api/bootstrap', { headers: { Cookie: registrationCookie } });
  assert(registeredSession?.data.user?.email === registration.email, 'El registro no inicia sesión automáticamente');
  const studentLogin = await request('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: registration.email, password: registration.password }) });
  assert(studentLogin.response.status === 200 && studentLogin.data.user.studentCode === registration.studentCode && studentLogin.data.user.career === registration.career, 'El código y la carrera no persisten al volver a entrar');
  const duplicateCode = await request('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...registration, email: 'otro.estudiante@utec.edu.pe' }) });
  assert(duplicateCode.response.status === 409, 'El registro acepta un código de estudiante repetido');
  const profilePayload = { name: 'Nombre Actualizado', studentCode: '202600002', career: initial.data.careers.find(value => value !== registration.career), birthDate: '2004-06-12' };
  const studentCookie = studentLogin.response.headers.get('set-cookie')?.split(';')[0];
  assert(studentCookie, 'No se creó la sesión del estudiante registrado');
  const withoutSession = await request('/api/account/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profilePayload) });
  assert(withoutSession.response.status === 401, 'Se pudo editar un perfil sin iniciar sesión');
  const profileHeaders = { 'Content-Type': 'application/json', Cookie: studentCookie };
  const duplicateProfileCode = await request('/api/account/profile', { method: 'POST', headers: profileHeaders, body: JSON.stringify({ ...profilePayload, studentCode: '999900001' }) });
  assert(duplicateProfileCode.response.status === 409, 'Se pudo cambiar al código de otro estudiante');
  const invalidProfileCode = await request('/api/account/profile', { method: 'POST', headers: profileHeaders, body: JSON.stringify({ ...profilePayload, studentCode: 'ABC1234' }) });
  assert(invalidProfileCode.response.status === 400, 'El perfil acepta letras en el código de estudiante');
  const invalidBirthDate = await request('/api/account/profile', { method: 'POST', headers: profileHeaders, body: JSON.stringify({ ...profilePayload, birthDate: '2099-01-01' }) });
  assert(invalidBirthDate.response.status === 400, 'Se aceptó una fecha de nacimiento futura');
  const updatedProfile = await request('/api/account/profile', { method: 'POST', headers: profileHeaders, body: JSON.stringify(profilePayload) });
  assert(updatedProfile.response.status === 200 && updatedProfile.data.user.name === profilePayload.name && updatedProfile.data.user.studentCode === profilePayload.studentCode && updatedProfile.data.user.career === profilePayload.career && updatedProfile.data.user.birthDate === profilePayload.birthDate, 'No se actualizó el perfil');
  const persistedProfile = await request('/api/bootstrap', { headers: { Cookie: studentCookie } });
  assert(persistedProfile.data.user.birthDate === profilePayload.birthDate && persistedProfile.data.user.studentCode === profilePayload.studentCode, 'El perfil editado no persiste');
  const clearedBirthDate = await request('/api/account/profile', { method: 'POST', headers: profileHeaders, body: JSON.stringify({ ...profilePayload, birthDate: null }) });
  assert(clearedBirthDate.response.status === 200 && clearedBirthDate.data.user.birthDate === null, 'No se pudo quitar la fecha de nacimiento opcional');
  const kitchen = await request('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'cocina.demo@menuu.test', password: 'MenuuCocina2026!' }) });
  assert(kitchen.response.status === 403, 'La cocina pudo entrar como consumidor');
  const login = await request('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'alex.demo@utec.edu.pe', password: 'MenuuEstudiante2026!' }) });
  assert(login.response.status === 200, 'No accede la cuenta de estudiante');
  assert(login.data.user.studentCode === '999900001' && login.data.user.career === 'Ciencia de la Computación', 'La cuenta de prueba no conserva código y carrera');
  const cookie = login.response.headers.get('set-cookie')?.split(';')[0];
  assert(cookie, 'No se creó la sesión');

  const offer = initial.data.catalog.offerings.find(value => value.bookable && value.customization.some(group => group.required));
  assert(offer, 'No hay oferta futura personalizable');
  const closedOffer = initial.data.catalog.offerings.find(value => value.bookable && value.id !== offer.id);
  assert(closedOffer, 'No hay otra oferta para comprobar su plazo de reserva');
  const cutoffClient = new pg.Client({ connectionString: databaseUrl });
  await cutoffClient.connect();
  try {
    await cutoffClient.query("UPDATE offers SET booking_deadline_at=now()-interval '1 second' WHERE id=$1", [closedOffer.id]);
    const afterCutoff = await request('/api/bootstrap', { headers: { Cookie: cookie } });
    assert(afterCutoff.data.catalog.offerings.find(value => value.id === closedOffer.id).bookable === false, 'El catálogo sigue ofreciendo un plato fuera de plazo');
    const lateBooking = await request('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ items: [{ offeringId: closedOffer.id, quantity: 1, choices: {} }] }) });
    assert(lateBooking.response.status === 409, 'El servidor aceptó una reserva después del cierre');
  } finally {
    await cutoffClient.query('UPDATE offers SET booking_deadline_at=$2 WHERE id=$1', [closedOffer.id, closedOffer.bookingDeadline]);
    await cutoffClient.end();
  }
  const choices = Object.fromEntries(offer.customization.filter(group => group.required).map(group => [group.id, [group.choices[0].id]]));
  const headers = { 'Content-Type': 'application/json', Cookie: cookie };
  const invalid = await request('/api/bookings', { method: 'POST', headers, body: JSON.stringify({ items: [{ offeringId: offer.id, quantity: 1, choices: {} }] }) });
  assert(invalid.response.status === 400, 'La reserva omitió opciones obligatorias');
  const tooMany = await request('/api/bookings', { method: 'POST', headers, body: JSON.stringify({ items: [{ offeringId: offer.id, quantity: 1, choices: { ...choices, [extras.id]: extras.choices.map(choice => choice.id) } }] }) });
  assert(tooMany.response.status === 400, 'Se aceptaron más opciones que el límite');
  const tooLong = await request('/api/bookings', { method: 'POST', headers, body: JSON.stringify({ items: [{ offeringId: offer.id, quantity: 1, choices, comment: 'x'.repeat(201) }] }) });
  assert(tooLong.response.status === 400, 'Se aceptó un comentario demasiado largo');
  const unlimited = { ...extras, required: true, maxSelections: null };
  assert(selectCustomization([unlimited], { [extras.id]: extras.choices.map(choice => choice.id) }).length === 3, 'Falló la opción sin límite');
  const bookingPayload = { requestKey: 'smoke-booking-001', items: [{ offeringId: offer.id, quantity: 1, choices: { ...choices, [extras.id]: extras.choices.slice(0, 2).map(choice => choice.id) }, comment: '  Sin   cebolla  ' }] };
  const booked = await request('/api/bookings', { method: 'POST', headers, body: JSON.stringify(bookingPayload) });
  assert(booked.response.status === 201, `No se reservó: ${JSON.stringify(booked.data)}`);
  const repeated = await request('/api/bookings', { method: 'POST', headers, body: JSON.stringify(bookingPayload) });
  assert(repeated.response.status === 201 && repeated.data.orders[0].id === booked.data.orders[0].id, 'El reintento duplicó la reserva');
  const changedRetry = await request('/api/bookings', { method: 'POST', headers, body: JSON.stringify({ ...bookingPayload, items: [{ ...bookingPayload.items[0], quantity: 2 }] }) });
  assert(changedRetry.response.status === 409, 'Se reutilizó una clave de reserva con otro carrito');
  assert(booked.data.orders[0].items[0].comment === 'Sin cebolla', 'No se guardó el comentario');
  assert(booked.data.orders[0].items[0].choices.length === 4, 'No se guardaron todas las opciones');
  const after = await request('/api/bootstrap', { headers: { Cookie: cookie } });
  assert(after.data.orders.length === 1, 'La reserva no aparece en pedidos');
  assert(after.data.catalog.offerings.find(value => value.id === offer.id).remaining === offer.remaining - 1, 'El cupo no se redujo');
  assert(after.data.orders[0].fulfillmentStatus === 'pending' && after.data.orders[0].reviewEnabled === false, 'Una reserva nueva habilitó reseñas antes de entrega');
  assert(after.data.catalog.sales.length === 0, 'Una reserva pendiente se contó como venta');
  assert(after.data.catalog.weeklyDishSales.some(row => row.week === offer.week && row.kitchenId === offer.kitchenId && row.dishId === offer.dishId && row.units === 1 && row.orderCount === 1), 'El ranking semanal no cuenta la reserva confirmada para la fecha del plato');
  const earlyReview = await request(`/api/orders/${booked.data.orders[0].id}/review`, { method: 'POST', headers, body: JSON.stringify({ kitchenRating: 5, foodRatings: [{ orderItemId: after.data.orders[0].items[0].id, rating: 5 }] }) });
  assert(earlyReview.response.status === 403, 'Se aceptó una reseña sin confirmación de entrega');
  const futureClient = new pg.Client({ connectionString: databaseUrl });
  await futureClient.connect();
  try {
    await futureClient.query("UPDATE orders SET fulfillment_status='delivered',review_enabled=true WHERE id=$1", [booked.data.orders[0].id]);
    const beforeTime = await request(`/api/orders/${booked.data.orders[0].id}/review`, { method: 'POST', headers, body: JSON.stringify({ kitchenRating: 5, foodRatings: [{ orderItemId: after.data.orders[0].items[0].id, rating: 5 }] }) });
    assert(beforeTime.response.status === 403, 'Se aceptó una reseña antes de la hora de entrega');
  } finally {
    await futureClient.query("UPDATE orders SET fulfillment_status='pending',review_enabled=false WHERE id=$1", [booked.data.orders[0].id]);
    await futureClient.end();
  }

  await stopServer();
  startServer();
  await waitForServer();
  const persisted = await request('/api/bootstrap', { headers: { Cookie: cookie } });
  assert(persisted.data.user?.id === 'estudiante-demo' && persisted.data.orders.length === 1, 'La sesión o reserva no sobrevivió al reinicio');

  const limited = initial.data.catalog.offerings.find(value => value.bookable && value.customization.length === 0);
  assert(limited, 'Falta una oferta sin opciones');
  const scoped = new pg.Client({ connectionString: databaseUrl });
  await scoped.connect();
  try {
    await scoped.query('UPDATE offers SET capacity=1 WHERE id=$1 AND reserved_count=0', [limited.id]);
    const item = { offeringId: limited.id, quantity: 1, choices: {}, comment: '' };
    const responses = await Promise.all([1, 2].map(() => request('/api/bookings', { method: 'POST', headers, body: JSON.stringify({ items: [item] }) })));
    assert(responses.map(value => value.response.status).sort().join(',') === '201,409', 'Dos reservas simultáneas superaron el cupo');
    const count = await scoped.query('SELECT reserved_count FROM offers WHERE id=$1', [limited.id]);
    assert(count.rows[0].reserved_count === 1, 'El cupo final es incorrecto');
  } finally { await scoped.end(); }
  const temporary = await mkdtemp(join(tmpdir(), 'menuu-import-smoke-'));
  const legacyFile = join(temporary, 'legacy.json');
  try {
    const historicalOffer = 'la-olla-de-la-u:2026-01-05:13:00:arroz-con-pollo';
    const legacy = {
      users: [{ id: 'estudiante-demo', name: 'Alex UTEC', email: 'alex.demo@utec.edu.pe', passwordHash: hashPassword('MenuuEstudiante2026!'), role: 'consumer' }],
      orders: [{ id: 'legacy-order-smoke', code: 'MU-LEGACY-SMOKE', userId: 'estudiante-demo', kitchenId: 'la-olla-de-la-u', kitchenName: 'La Olla de la U',
        date: '2026-01-05', deliveryTime: '13:00', pickupUntil: '13:10', pickupPoint: 'Comedor UTEC', status: 'reservado', payment: 'QR al recibir',
        totalSoles: 15.9, createdAt: '2026-01-04T12:00:00.000Z', items: [{ offeringId: historicalOffer, dishId: 'arroz-con-pollo', name: 'Arroz con pollo',
          imageUrl: '/images/arroz-con-pollo.webp', quantity: 1, comment: 'Sin cebolla', unitPriceSoles: 15.9, totalSoles: 15.9,
          choices: [{ groupId: 'salsa', title: 'Salsa criolla', choiceId: 'normal', label: 'Con salsa criolla', priceSoles: 0 }] }] }],
    };
    await writeFile(legacyFile, JSON.stringify(legacy));
    for (const pass of [1, 2]) {
      const imported = spawn(process.execPath, ['scripts/import-json.mjs', legacyFile], { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: ['ignore', 'pipe', 'pipe'] });
      let importError = '';
      imported.stderr.on('data', chunk => { importError += chunk.toString(); });
      const code = await new Promise(resolve => imported.once('exit', resolve));
      assert(code === 0, `Falló la importación ${pass}: ${importError}`);
    }
    const verify = new pg.Client({ connectionString: databaseUrl });
    await verify.connect();
    try {
      const rows = await verify.query(`SELECT o.total_cents,i.comment,c.choice_label,f.reserved_count
        FROM orders o JOIN order_items i ON i.order_id=o.id JOIN order_item_choices c ON c.order_item_id=i.id
        JOIN offers f ON f.id=i.offer_id WHERE o.id='legacy-order-smoke'`);
      assert(rows.rowCount === 1 && rows.rows[0].total_cents === 1590 && rows.rows[0].reserved_count === 1 && rows.rows[0].comment === 'Sin cebolla' && rows.rows[0].choice_label === 'Con salsa criolla', 'La importación duplicó o alteró un pedido histórico');
    } finally { await verify.end(); }
  } finally { await unlink(legacyFile).catch(() => {}); await rmdir(temporary).catch(() => {}); }
  const reviewClient = new pg.Client({ connectionString: databaseUrl });
  await reviewClient.connect();
  let historicalItemId;
  try {
    await reviewClient.query("UPDATE orders SET fulfillment_status='delivered',review_enabled=true WHERE id='legacy-order-smoke'");
    historicalItemId = (await reviewClient.query("SELECT id::text AS id FROM order_items WHERE order_id='legacy-order-smoke'")).rows[0].id;
  } finally { await reviewClient.end(); }
  const deliverable = await request('/api/bootstrap', { headers: { Cookie: cookie } });
  assert(deliverable.data.catalog.sales.some(row => row.kitchenId === 'la-olla-de-la-u' && row.units >= 1), 'El ranking no refleja platos entregados');
  const missingDish = await request('/api/orders/legacy-order-smoke/review', { method: 'POST', headers, body: JSON.stringify({ kitchenRating: 5, foodRatings: [] }) });
  assert(missingDish.response.status === 400, 'Se aceptó una reseña sin calificar platos');
  const reviewPayload = { kitchenRating: 5, foodRatings: [{ orderItemId: historicalItemId, rating: 4 }] };
  const reviewed = await request('/api/orders/legacy-order-smoke/review', { method: 'POST', headers, body: JSON.stringify(reviewPayload) });
  assert(reviewed.response.status === 201, `No se guardó la reseña habilitada: ${JSON.stringify(reviewed.data)}`);
  const repeatedReview = await request('/api/orders/legacy-order-smoke/review', { method: 'POST', headers, body: JSON.stringify(reviewPayload) });
  assert(repeatedReview.response.status === 409, 'Se duplicó una reseña');
  const rated = await request('/api/bootstrap', { headers: { Cookie: cookie } });
  assert(rated.data.catalog.kitchens.find(kitchen => kitchen.id === 'la-olla-de-la-u').rating === 5, 'La puntuación de la cocina no se actualizó');
  assert(rated.data.orders.find(order => order.id === 'legacy-order-smoke').items[0].foodRating === 4, 'La puntuación del plato no se guardó');
  const absent = new pg.Client({ connectionString: databaseUrl });
  await absent.connect();
  try { await absent.query("UPDATE orders SET fulfillment_status='no_show' WHERE id=$1", [booked.data.orders[0].id]); }
  finally { await absent.end(); }
  const blocked = await request('/api/bootstrap', { headers: { Cookie: cookie } });
  assert(blocked.data.user.bookingAllowed === false && blocked.data.orders.some(order => order.status === 'no_se_presento'), 'La ausencia no aparece en pedidos ni restringe reservas');
  const anotherBooking = await request('/api/bookings', { method: 'POST', headers, body: JSON.stringify({ ...bookingPayload, requestKey: 'smoke-blocked-002' }) });
  assert(anotherBooking.response.status === 403, 'Una cuenta con ausencia pudo volver a reservar');
  console.log('OK: PostgreSQL, reservas, entrega, reseñas verificadas, puntuaciones y restricción por ausencia.');
} finally {
  await stopServer();
  if (!/^menuu_smoke_[a-f0-9]{12}$/.test(schema)) throw new Error('Esquema de prueba inesperado');
  await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await admin.end();
}
