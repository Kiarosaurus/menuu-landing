import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KITCHEN, KITCHENS, SEED_DISHES, bookingDeadline, offerings } from '../server/catalog.mjs';
import { closePool, transaction } from '../server/db.mjs';
import { migrate } from './migrate.mjs';

const cents = soles => Math.round(Number(soles || 0) * 100);
const source = resolve(process.argv[2] || fileURLToPath(new URL('../server/data/db.json', import.meta.url)));

async function importJson() {
  const legacy = JSON.parse(await readFile(source, 'utf8'));
  if (!Array.isArray(legacy.users) || !Array.isArray(legacy.orders)) throw new Error('El JSON debe contener users y orders como listas.');
  const dishes = Array.isArray(legacy.dishes) ? legacy.dishes : SEED_DISHES;
  await migrate();
  const result = await transaction(async client => {
    const kitchens = new Map(KITCHENS.map(kitchen => [kitchen.id, kitchen]));
    for (const kitchen of legacy.kitchens || []) kitchens.set(kitchen.id, kitchen);
    for (const user of legacy.users) if (user.kitchenId && !kitchens.has(user.kitchenId)) kitchens.set(user.kitchenId, { id: user.kitchenId, name: user.name || user.kitchenId });
    for (const order of legacy.orders) if (order.kitchenId && !kitchens.has(order.kitchenId)) kitchens.set(order.kitchenId, { id: order.kitchenId, name: order.kitchenName || order.kitchenId });
    for (const dish of dishes) if (dish.kitchenId && !kitchens.has(dish.kitchenId)) kitchens.set(dish.kitchenId, { id: dish.kitchenId, name: dish.kitchenName || dish.kitchenId });
    for (const kitchen of kitchens.values()) {
      await client.query(`INSERT INTO kitchens (id,name,description,image_url,logo_url,test_account) VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (id) DO UPDATE SET logo_url = CASE WHEN kitchens.logo_url = '' THEN EXCLUDED.logo_url ELSE kitchens.logo_url END`,
        [kitchen.id, kitchen.name, kitchen.description || '', kitchen.imageUrl || '', kitchen.logoUrl || '', Boolean(kitchen.testAccount)]);
    }
    for (const user of legacy.users) {
      if (!user.id || !user.passwordHash || !user.email) throw new Error(`Cuenta incompleta en JSON: ${user.id || 'sin ID'}`);
      await client.query(`INSERT INTO users (id,name,email,password_hash,role,kitchen_id,student_code,career,created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
        [user.id, user.name, user.email.toLowerCase(), user.passwordHash, user.role, user.kitchenId || null, user.studentCode || null, user.career || null, user.createdAt || new Date().toISOString()]);
    }
    for (const dish of dishes) {
      const kitchenId = dish.kitchenId || KITCHEN.id;
      await client.query(`INSERT INTO dishes (kitchen_id,id,name,description,price_cents,image_url,image_alt)
        VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (kitchen_id,id) DO NOTHING`,
        [kitchenId, dish.id, dish.name, dish.description || '', cents(dish.priceSoles), dish.imageUrl || '', dish.imageAlt || '']);
      for (const [index, group] of (dish.customization || []).entries()) {
        const type = group.selectionType === 'multiple' ? 'multiple' : 'single';
        const max = type === 'single' ? 1 : group.maxSelections ?? null;
        await client.query(`INSERT INTO option_groups (kitchen_id,dish_id,id,title,selection_type,required,max_selections,sort_order)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (kitchen_id,dish_id,id) DO NOTHING`,
          [kitchenId, dish.id, group.id, group.title, type, Boolean(group.required), max, index]);
        for (const [choiceIndex, choice] of group.choices.entries()) {
          await client.query(`INSERT INTO option_choices (kitchen_id,dish_id,group_id,id,label,price_cents,sort_order)
            VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (kitchen_id,dish_id,group_id,id) DO NOTHING`,
            [kitchenId, dish.id, group.id, choice.id, choice.label, cents(choice.priceSoles), choiceIndex]);
        }
      }
    }
    for (const offer of offerings(new Date(), dishes)) {
      await client.query(`INSERT INTO offers (id,kitchen_id,dish_id,offer_date,delivery_time,pickup_until,booking_deadline_at,capacity,sort_order)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
        [offer.id, offer.kitchenId, offer.id.split(':').at(-1), offer.date, offer.deliveryTime, offer.pickupUntil, offer.bookingDeadline, offer.capacity, offer.sortOrder]);
    }
    let importedOrders = 0;
    for (const order of legacy.orders) {
      if ((await client.query('SELECT 1 FROM orders WHERE id=$1', [order.id])).rowCount) continue;
      const orderItems = order.items || [];
      for (const item of orderItems) {
        const dishId = item.dishId || item.offeringId?.split(':').at(-1);
        const existing = await client.query('SELECT 1 FROM offers WHERE id=$1', [item.offeringId]);
        if (!existing.rowCount) {
          const capacity = Math.max(1, orderItems.filter(value => value.offeringId === item.offeringId).reduce((sum, value) => sum + value.quantity, 0));
          await client.query(`INSERT INTO offers (id,kitchen_id,dish_id,offer_date,delivery_time,pickup_until,booking_deadline_at,capacity)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
            [item.offeringId, order.kitchenId, dishId, order.date, order.deliveryTime, order.pickupUntil, item.bookingDeadline || bookingDeadline(order.date, order.deliveryTime).toISOString(), capacity]);
        }
      }
      await client.query(`INSERT INTO orders (id,code,user_id,kitchen_id,kitchen_name,offer_date,delivery_time,pickup_until,pickup_point,status,payment,total_cents,created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [order.id, order.code, order.userId, order.kitchenId, order.kitchenName, order.date, order.deliveryTime, order.pickupUntil,
          order.pickupPoint === 'Cafetería de UTEC' ? 'Comedor UTEC' : order.pickupPoint || 'Comedor UTEC', order.status === 'cancelado' ? 'cancelado' : 'reservado', order.payment || 'QR al recibir', cents(order.totalSoles), order.createdAt || new Date().toISOString()]);
      for (const [index, item] of orderItems.entries()) {
        const saved = await client.query(`INSERT INTO order_items (order_id,offer_id,dish_name,image_url,quantity,comment,unit_price_cents,total_cents,sort_order)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
          [order.id, item.offeringId, item.name, item.imageUrl || '', item.quantity, item.comment || '', cents(item.unitPriceSoles), cents(item.totalSoles), index]);
        for (const [choiceIndex, choice] of (item.choices || []).entries()) {
          await client.query(`INSERT INTO order_item_choices (order_item_id,group_id,group_title,choice_id,choice_label,price_cents,sort_order)
            VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [saved.rows[0].id, choice.groupId, choice.title, choice.choiceId, choice.label, cents(choice.priceSoles), choiceIndex]);
        }
      }
      importedOrders += 1;
    }
    await client.query(`WITH counts AS (
      SELECT o.id,COALESCE(sum(i.quantity) FILTER (WHERE r.status='reservado'),0)::integer AS total
      FROM offers o LEFT JOIN order_items i ON i.offer_id=o.id LEFT JOIN orders r ON r.id=i.order_id GROUP BY o.id
    ) UPDATE offers o SET capacity=GREATEST(o.capacity,counts.total),reserved_count=counts.total
      FROM counts WHERE counts.id=o.id`);
    return { users: legacy.users.length, dishes: dishes.length, orders: importedOrders };
  });
  console.log(`Importación completa: ${result.users} cuentas, ${result.dishes} platos, ${result.orders} reservas nuevas.`);
}

try { await importJson(); }
catch (error) { console.error(error); process.exitCode = 1; }
finally { await closePool(); }
