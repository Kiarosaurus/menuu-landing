import { randomUUID } from 'node:crypto';
import { saveDish, saveOffer, kitchenData, kitchenImage, saveKitchenImage } from '../server/kitchen.mjs';
import { getCatalog } from '../server/repository.mjs';
import { closePool, getPool } from '../server/db.mjs';

const kitchenId = 'la-olla-de-la-u';
let dishId, offerId, imageId;
try {
  const data = await kitchenData(kitchenId);
  if (!data.profile || !data.dishes.length) throw new Error('No se cargó el panel de cocina.');
  const imageUrl = await saveKitchenImage(kitchenId, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl4g1EAAAAASUVORK5CYII=', 'base64'), 'image/png', false);
  imageId = imageUrl.split('/').at(-1);
  if ((await kitchenImage(imageId))?.mime !== 'image/png') throw new Error('No se guardó la imagen de la cocina.');
  const monday = new Date();
  const lima = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(monday);
  const next = new Date(`${lima}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() - ((next.getUTCDay() + 6) % 7) + 9);
  const date = next.toISOString().slice(0, 10);
  dishId = await saveDish(kitchenId, { name: `Plato de control ${randomUUID().slice(0, 6)}`, description: 'Solo para verificar el panel.', priceSoles: 12, imageUrl: '/images/arroz-con-pollo.webp', imageAlt: 'Plato de control', customization: [{ id: 'salsa', title: 'Salsa', selectionType: 'single', required: true, maxSelections: 1, choices: [{ id: 'si', label: 'Con salsa', priceSoles: 0 }, { id: 'no', label: 'Sin salsa', priceSoles: 0 }] }] });
  offerId = await saveOffer(kitchenId, { dishId, date, deliveryTime: '13:00', pickupUntil: '13:10', bookingDeadline: `${date}T12:00:00-05:00`, capacity: 5, priceSoles: 13, descriptionOverride: 'Con un toque especial.', hasCustomizationOverride: true, customization: [{ id: 'extra', title: 'Extra', selectionType: 'single', required: false, choices: [{ id: 'uno', label: 'Uno', priceSoles: 1 }, { id: 'dos', label: 'Dos', priceSoles: 0 }] }] });
  const offer = (await getCatalog()).offerings.find(item => item.id === offerId);
  if (!offer || offer.priceSoles !== 13 || offer.description !== 'Con un toque especial.' || offer.customization[0]?.id !== 'extra') throw new Error('La oferta no reflejó sus cambios en el catálogo.');
  let denied = false;
  const otherDish = (await kitchenData('chaufa-club')).dishes[0].id;
  try { await saveOffer('chaufa-club', { id: offerId, dishId: otherDish, date, deliveryTime: '13:00', pickupUntil: '13:10', bookingDeadline: `${date}T12:00:00-05:00`, capacity: 5 }); } catch (cause) { denied = cause.status === 404; }
  if (!denied) throw new Error('Una cocina pudo editar una oferta ajena.');
  console.log('OK: panel, imagen, platos, menú con variantes y aislamiento entre cocinas.');
} finally {
  if (offerId) await getPool().query('DELETE FROM offers WHERE id=$1', [offerId]);
  if (imageId) await getPool().query('DELETE FROM kitchen_images WHERE id=$1', [imageId]);
  if (dishId) { await getPool().query('DELETE FROM option_choices WHERE kitchen_id=$1 AND dish_id=$2', [kitchenId, dishId]); await getPool().query('DELETE FROM option_groups WHERE kitchen_id=$1 AND dish_id=$2', [kitchenId, dishId]); await getPool().query('DELETE FROM dishes WHERE kitchen_id=$1 AND id=$2', [kitchenId, dishId]); }
  await closePool();
}
