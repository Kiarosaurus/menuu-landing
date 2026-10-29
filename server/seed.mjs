import { KITCHENS, SEED_DISHES, offerings } from "./catalog.mjs";
import { transaction } from "./db.mjs";
import { demoAccounts, hashPassword } from "./store.mjs";

const cents = (soles) => Math.round(soles * 100);

export async function seedDemo(now = new Date()) {
  await transaction(async (tx) => {
    for (const kitchen of KITCHENS) {
      await tx.execute(
        `INSERT INTO kitchens (id, name, description, image_url, logo_url, test_account) VALUES (?,?,?,?,?,?)
          ON CONFLICT (id) DO UPDATE SET logo_url = CASE WHEN kitchens.logo_url = '' THEN excluded.logo_url ELSE kitchens.logo_url END`,
        [
          kitchen.id,
          kitchen.name,
          kitchen.description,
          kitchen.imageUrl,
          kitchen.logoUrl,
          kitchen.testAccount ? 1 : 0,
        ],
      );
    }
    for (const account of demoAccounts) {
      await tx.execute(
        `INSERT INTO users (id, name, email, password_hash, role, kitchen_id, student_code, career)
          VALUES (?,?,?,?,?,?,?,?) ON CONFLICT (id) DO UPDATE SET
          student_code=COALESCE(users.student_code, excluded.student_code),
          career=COALESCE(users.career, excluded.career)`,
        [
          account.id,
          account.name,
          account.email,
          hashPassword(account.password),
          account.role,
          account.kitchenId || null,
          account.studentCode || null,
          account.career || null,
        ],
      );
    }
    for (const dish of SEED_DISHES) {
      await tx.execute(
        "INSERT OR IGNORE INTO dishes (kitchen_id, id, name, description, price_cents, image_url, image_alt) VALUES (?,?,?,?,?,?,?)",
        [
          dish.kitchenId,
          dish.id,
          dish.name,
          dish.description,
          cents(dish.priceSoles),
          dish.imageUrl,
          dish.imageAlt,
        ],
      );
      for (const [index, group] of dish.customization.entries()) {
        await tx.execute(
          "INSERT OR IGNORE INTO option_groups (kitchen_id,dish_id,id,title,selection_type,required,max_selections,sort_order) VALUES (?,?,?,?,?,?,?,?)",
          [
            dish.kitchenId,
            dish.id,
            group.id,
            group.title,
            group.selectionType,
            group.required ? 1 : 0,
            group.maxSelections,
            index,
          ],
        );
        for (const [choiceIndex, choice] of group.choices.entries()) {
          await tx.execute(
            "INSERT OR IGNORE INTO option_choices (kitchen_id,dish_id,group_id,id,label,price_cents,sort_order) VALUES (?,?,?,?,?,?,?)",
            [
              dish.kitchenId,
              dish.id,
              group.id,
              choice.id,
              choice.label,
              cents(choice.priceSoles),
              choiceIndex,
            ],
          );
        }
      }
    }
    for (const offer of offerings(now)) {
      // dishId is embedded in the offer id as the last segment (kitchenId:dishId:date:time → last part varies)
      const dishId = offer.id.split(":").at(-1);
      await tx.execute(
        `INSERT OR IGNORE INTO offers (id,kitchen_id,dish_id,offer_date,delivery_time,pickup_until,booking_deadline_at,capacity,sort_order)
          VALUES (?,?,?,?,?,?,?,?,?)`,
        [
          offer.id,
          offer.kitchenId,
          dishId,
          offer.date,
          offer.deliveryTime,
          offer.pickupUntil,
          offer.bookingDeadline,
          offer.capacity,
          offer.sortOrder,
        ],
      );
    }
  });
}
