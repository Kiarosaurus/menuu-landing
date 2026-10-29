import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const demoAccounts = [
  { id: 'estudiante-demo', name: 'Alex UTEC', email: 'alex.demo@utec.edu.pe', password: 'MenuuEstudiante2026!', role: 'consumer', studentCode: '999900001', career: 'Ciencia de la Computación' },
  { id: 'cocina-demo', name: 'La Olla de la U', email: 'cocina.demo@menuu.test', password: 'MenuuCocina2026!', role: 'kitchen', kitchenId: 'la-olla-de-la-u' },
  { id: 'chaufa-club-demo', name: 'Chaufa Club', email: 'chaufa.club@menuu.test', password: 'MenuuChaufa2026!', role: 'kitchen', kitchenId: 'chaufa-club' },
  { id: 'esquina-criolla-demo', name: 'La Esquina Criolla', email: 'esquina.criolla@menuu.test', password: 'MenuuCriolla2026!', role: 'kitchen', kitchenId: 'la-esquina-criolla' },
];

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const [salt, expected] = stored.split(':');
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, 'hex');
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}

export function publicUser(user) {
  if (!user) return null;
  const { id, name, email, role, kitchenId, studentCode, career, birthDate, bookingAllowed } = user;
  return { id, name, email, role, kitchenId, studentCode: studentCode || null, career: career || null, birthDate: birthDate || null, bookingAllowed: bookingAllowed !== false };
}
