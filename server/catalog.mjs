export const KITCHEN = {
  id: 'la-olla-de-la-u',
  name: 'La Olla de la U',
  description: 'Comida casera para tu break.',
  imageUrl: '/images/arroz-con-pollo.webp',
  logoUrl: '/images/logo-la-olla.svg',
  testAccount: true,
};
export const KITCHENS = [KITCHEN,
  { id: 'chaufa-club', name: 'Chaufa Club', description: 'Chaufa casero recién hecho para tu break.', imageUrl: '/images/chaufa-wok.webp', logoUrl: '/images/logo-chaufa-club.svg', testAccount: true },
  { id: 'la-esquina-criolla', name: 'La Esquina Criolla', description: 'Almuerzos criollos de todos los días.', imageUrl: '/images/lomo-saltado.webp', logoUrl: '/images/logo-esquina-criolla.svg', testAccount: true },
];

export const SEED_DISHES = [
  {
    kitchenId: KITCHEN.id,
    id: 'arroz-con-pollo',
    name: 'Arroz con pollo',
    description: 'Arroz verde con pollo y salsa criolla.',
    priceSoles: 15.9,
    imageUrl: '/images/arroz-con-pollo.webp',
    imageAlt: 'Arroz con pollo peruano y salsa criolla en un envase plástico descartable',
    customization: [
      { id: 'salsa', title: 'Salsa criolla', selectionType: 'single', required: true, maxSelections: 1, choices: [
        { id: 'normal', label: 'Con salsa criolla', priceSoles: 0 },
        { id: 'sin-salsa', label: 'Sin salsa criolla', priceSoles: 0 },
      ] },
      { id: 'aji', title: 'Ají', selectionType: 'single', required: true, maxSelections: 1, choices: [
        { id: 'sin-aji', label: 'Sin ají', priceSoles: 0 },
        { id: 'aparte', label: 'Ají aparte', priceSoles: 0 },
      ] },
      { id: 'extras', title: 'Extras', selectionType: 'multiple', required: false, maxSelections: 2, choices: [
        { id: 'huevo', label: 'Huevo frito', priceSoles: 2 },
        { id: 'platano', label: 'Plátano frito', priceSoles: 2 },
        { id: 'palta', label: 'Palta', priceSoles: 3 },
      ] },
    ],
  },
  {
    kitchenId: KITCHEN.id,
    id: 'tallarines-verdes',
    name: 'Tallarines verdes',
    description: 'Tallarines verdes con bistec.',
    priceSoles: 17.9,
    imageUrl: '/images/tallarines-verdes.webp',
    imageAlt: 'Tallarines verdes peruanos con bistec en un envase plástico descartable',
    customization: [],
  },
  {
    kitchenId: 'chaufa-club', id: 'chaufa-de-pollo', name: 'Chaufa de pollo',
    description: 'Arroz salteado con pollo, huevo y cebolla china.', priceSoles: 16.9,
    imageUrl: '/images/chaufa-wok.webp', imageAlt: 'Chaufa peruano de pollo con huevo y cebolla china en envase plástico descartable',
    customization: [
      { id: 'aji', title: 'Ají', selectionType: 'single', required: false, maxSelections: 1, choices: [
        { id: 'aparte', label: 'Ají aparte', priceSoles: 0 }, { id: 'sin-aji', label: 'Sin ají', priceSoles: 0 },
      ] },
    ],
  },
  {
    kitchenId: 'la-esquina-criolla', id: 'lomo-saltado', name: 'Lomo saltado',
    description: 'Carne salteada con tomate, cebolla, papas y arroz.', priceSoles: 19.9,
    imageUrl: '/images/lomo-saltado.webp', imageAlt: 'Lomo saltado peruano con papas fritas y arroz blanco en envase plástico descartable', customization: [],
  },
  {
    kitchenId: 'la-esquina-criolla', id: 'aji-de-gallina', name: 'Ají de gallina',
    description: 'Gallina en salsa de ají amarillo con arroz y papa.', priceSoles: 17.5,
    imageUrl: '/images/aji-de-gallina.webp', imageAlt: 'Ají de gallina peruano con arroz, huevo y aceituna en envase plástico descartable', customization: [],
  },
];

// Planificación de muestra: la cocina decide qué días y platos publica.
// Se proyecta sobre la semana actual y la siguiente para mantener útil la cuenta de prueba.
const weeklyPlan = [
  { day: 1, time: '13:00', kitchenId: KITCHEN.id, dishId: 'arroz-con-pollo', slots: 12 },
  { day: 1, time: '13:00', kitchenId: KITCHEN.id, dishId: 'tallarines-verdes', slots: 8 },
  { day: 2, time: '13:00', kitchenId: 'chaufa-club', dishId: 'chaufa-de-pollo', slots: 14 },
  { day: 2, time: '13:00', kitchenId: 'la-esquina-criolla', dishId: 'lomo-saltado', slots: 10 },
  { day: 3, time: '13:00', kitchenId: KITCHEN.id, dishId: 'arroz-con-pollo', slots: 10 },
  { day: 4, time: '13:00', kitchenId: 'chaufa-club', dishId: 'chaufa-de-pollo', slots: 12, bookingLeadMinutes: 2 * 24 * 60 },
  { day: 4, time: '13:00', kitchenId: 'la-esquina-criolla', dishId: 'aji-de-gallina', slots: 10 },
  { day: 5, time: '13:00', kitchenId: KITCHEN.id, dishId: 'tallarines-verdes', slots: 10 },
  { day: 5, time: '13:00', kitchenId: 'la-esquina-criolla', dishId: 'lomo-saltado', slots: 10 },
];

function limaDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = type => parts.find(part => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function addDays(date, days) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function weekStart(now = new Date()) {
  const today = limaDate(now);
  const day = new Date(`${today}T12:00:00Z`).getUTCDay();
  return addDays(today, -(day === 0 ? 6 : day - 1));
}

export function deliveryMoment(date, time) {
  return new Date(`${date}T${time}:00-05:00`);
}

export function bookingDeadline(date, time, leadMinutes = 1) {
  return new Date(deliveryMoment(date, time).getTime() - leadMinutes * 60_000);
}

export function offerings(now = new Date(), dishes = SEED_DISHES) {
  const monday = weekStart(now);
  return [0, 1].flatMap(week => weeklyPlan.map((entry, index) => {
    const date = addDays(monday, week * 7 + entry.day - 1);
    const dish = dishes.find(value => value.id === entry.dishId && value.kitchenId === entry.kitchenId);
    if (!dish) return null;
    return {
      ...dish,
      id: `${entry.kitchenId}:${date}:${entry.time}:${entry.dishId}`,
      kitchenId: entry.kitchenId,
      kitchenName: KITCHENS.find(kitchen => kitchen.id === entry.kitchenId)?.name || '',
      date,
      deliveryTime: entry.time,
      bookingDeadline: bookingDeadline(date, entry.time, entry.bookingLeadMinutes).toISOString(),
      pickupUntil: (() => { const end = new Date(deliveryMoment(date, entry.time).getTime() + 10 * 60_000); return new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hour12: false }).format(end); })(),
      capacity: entry.slots,
      week,
      sortOrder: index,
    };
  }).filter(Boolean));
}

export function publicCatalog(orders = [], now = new Date(), dishes = SEED_DISHES) {
  const reserved = new Map();
  for (const order of orders) for (const item of order.items) reserved.set(item.offeringId, (reserved.get(item.offeringId) || 0) + item.quantity);
  return {
    kitchens: KITCHENS,
    weeks: [weekStart(now), addDays(weekStart(now), 7)],
    offerings: offerings(now, dishes).map(offer => ({
      ...offer,
      remaining: Math.max(0, offer.capacity - (reserved.get(offer.id) || 0)),
      bookable: new Date(offer.bookingDeadline).getTime() > now.getTime() && offer.capacity > (reserved.get(offer.id) || 0),
    })),
  };
}
