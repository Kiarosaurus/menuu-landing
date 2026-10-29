import { KITCHENS, SEED_DISHES, offerings } from './catalog.mjs';
import { transaction } from './db.mjs';
import { demoAccounts, hashPassword } from './store.mjs';

const cents = soles => Math.round(soles * 100);

export async function seedDemo(now = new Date()) {
  await transaction(async client => {
    for (const kitchen of KITCHENS) {
      await client.query(`INSERT INTO kitchens (id, name, description, image_url, logo_url, test_account) VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (id) DO UPDATE SET logo_url = CASE WHEN kitchens.logo_url = '' THEN EXCLUDED.logo_url ELSE kitchens.logo_url END`,
      [kitchen.id, kitchen.name, kitchen.description, kitchen.imageUrl, kitchen.logoUrl, kitchen.testAccount]);
    }
    for (const account of demoAccounts) {
      await client.query(`INSERT INTO users (id, name, email, password_hash, role, kitchen_id, student_code, career)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO UPDATE SET
        student_code=COALESCE(users.student_code, EXCLUDED.student_code), career=COALESCE(users.career, EXCLUDED.career)`,
      [account.id, account.name, account.email, hashPassword(account.password), account.role, account.kitchenId || null, account.studentCode || null, account.career || null]);
    }
    for (const dish of SEED_DISHES) {
      await client.query('INSERT INTO dishes (kitchen_id, id, name, description, price_cents, image_url, image_alt) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (kitchen_id,id) DO NOTHING', [dish.kitchenId, dish.id, dish.name, dish.description, cents(dish.priceSoles), dish.imageUrl, dish.imageAlt]);
      for (const [index, group] of dish.customization.entries()) {
        await client.query('INSERT INTO option_groups (kitchen_id,dish_id,id,title,selection_type,required,max_selections,sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (kitchen_id,dish_id,id) DO NOTHING', [dish.kitchenId, dish.id, group.id, group.title, group.selectionType, group.required, group.maxSelections, index]);
        for (const [choiceIndex, choice] of group.choices.entries()) {
          await client.query('INSERT INTO option_choices (kitchen_id,dish_id,group_id,id,label,price_cents,sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (kitchen_id,dish_id,group_id,id) DO NOTHING', [dish.kitchenId, dish.id, group.id, choice.id, choice.label, cents(choice.priceSoles), choiceIndex]);
        }
      }
    }
    for (const offer of offerings(now)) {
      await client.query(`INSERT INTO offers (id,kitchen_id,dish_id,offer_date,delivery_time,pickup_until,booking_deadline_at,capacity,sort_order)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO UPDATE SET
        booking_deadline_at=EXCLUDED.booking_deadline_at
        WHERE offers.booking_deadline_at = ((offers.offer_date + offers.delivery_time) AT TIME ZONE 'America/Lima') - interval '1 minute'
          AND EXCLUDED.booking_deadline_at <> offers.booking_deadline_at`,
      [offer.id, offer.kitchenId, offer.id.split(':').at(-1), offer.date, offer.deliveryTime, offer.pickupUntil, offer.bookingDeadline, offer.capacity, offer.sortOrder]);
    }
  });
}
