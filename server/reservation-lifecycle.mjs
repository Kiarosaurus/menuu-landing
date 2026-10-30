import { deliveryMoment } from "./catalog.mjs";
import { getDb, transaction } from "./db.mjs";

const invalid = (message, status = 409) =>
  Object.assign(new Error(message), { status });

function todayLima(now) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type) => parts.find((part) => part.type === type).value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export async function releaseOrderCapacity(db, orderId, kitchenId) {
  const items = await db.query(
    'SELECT offer_id AS "offerId",SUM(quantity) AS units FROM order_items WHERE order_id=$1 GROUP BY offer_id',
    [orderId],
  );
  for (const item of items.rows) {
    const released = await db.query(
      "UPDATE offers SET reserved_count=reserved_count-$2,sold_out_at=NULL WHERE id=$1 AND kitchen_id=$3 AND reserved_count>=$2 RETURNING id",
      [item.offerId, item.units, kitchenId],
    );
    if (!released.rowCount)
      throw invalid("No se pudo actualizar el cupo de este menú.");
  }
}

export async function expireOverdueReservations(now = new Date()) {
  const candidates = await getDb().query(
    `SELECT id,offer_date AS date,delivery_time AS "deliveryTime",created_at AS "createdAt"
     FROM orders WHERE status='reservado' AND fulfillment_status='pending' AND offer_date <= $1`,
    [todayLima(now)],
  );
  const overdue = candidates.rows
    .filter((order) => {
      const deadline =
        deliveryMoment(order.date, order.deliveryTime).getTime() + 15 * 60_000;
      return (
        now.getTime() >= deadline &&
        new Date(order.createdAt).getTime() <= deadline
      );
    })
    .map((order) => order.id);
  if (!overdue.length) return 0;
  return transaction(async (db) => {
    let updated = 0;
    for (const orderId of overdue) {
      const order = await db.query(
        `UPDATE orders SET fulfillment_status='no_show',review_enabled=0,auto_no_show_at=$2
         WHERE id=$1 AND status='reservado' AND fulfillment_status='pending'
         RETURNING kitchen_id AS "kitchenId"`,
        [orderId, now.toISOString()],
      );
      if (!order.rowCount) continue;
      await releaseOrderCapacity(db, orderId, order.rows[0].kitchenId);
      updated += 1;
    }
    return updated;
  });
}
