import { randomUUID } from "node:crypto";
import { getDb, transaction } from "./db.mjs";

const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
const soles = (value) => Math.round(Number(value) * 100);
const bool = (value) => value === 1 || value === true || value === "1";
const todayLima = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const text = (value, max) =>
  typeof value === "string" ? value.trim().slice(0, max + 1) : "";
const validTime = (value) =>
  typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const validDate = (value) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) &&
  new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
const validUrl = (value) =>
  typeof value === "string" &&
  (value.startsWith("/images/") ||
    /^\/api\/kitchen\/image\/[a-f0-9-]{36}$/.test(value) ||
    /^https:\/\//.test(value)) &&
  value.length <= 500;

/** Lima time as 'YYYY-MM-DD HH:MM' using SQLite datetime format. */
const limaDateStr = (d = new Date()) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(d)
    .replace("T", " ");

/** Start of current week (Monday) in Lima, as YYYY-MM-DD */
function limaWeekStart() {
  const today = todayLima();
  const d = new Date(`${today}T12:00:00Z`);
  const dow = d.getUTCDay(); // 0=Sun
  const offset = (dow + 6) % 7; // days since Monday
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

function validateOptions(groups) {
  if (!Array.isArray(groups) || groups.length > 8)
    fail("Revisa los grupos de personalización.");
  const ids = new Set();
  return groups.map((group, index) => {
    const title = text(group?.title, 60);
    const id =
      typeof group?.id === "string" && /^[a-zA-Z0-9_-]{1,60}$/.test(group.id)
        ? group.id
        : `grupo-${index + 1}`;
    if (!title || title.length > 60 || ids.has(id))
      fail("Cada grupo necesita un nombre distinto.");
    ids.add(id);
    const selectionType =
      group.selectionType === "multiple" ? "multiple" : "single";
    const required = Boolean(group.required);
    const maxSelections =
      selectionType === "single"
        ? 1
        : group.maxSelections == null || group.maxSelections === ""
          ? null
          : Number(group.maxSelections);
    if (
      maxSelections !== null &&
      (!Number.isInteger(maxSelections) || maxSelections < 1)
    )
      fail("El límite de elecciones no es válido.");
    if (
      !Array.isArray(group.choices) ||
      group.choices.length < 2 ||
      group.choices.length > 16
    )
      fail("Cada grupo necesita de 2 a 16 opciones.");
    const choiceIds = new Set();
    const choices = group.choices.map((choice, choiceIndex) => {
      const label = text(choice?.label, 60);
      const choiceId =
        typeof choice?.id === "string" &&
        /^[a-zA-Z0-9_-]{1,60}$/.test(choice.id)
          ? choice.id
          : `opcion-${choiceIndex + 1}`;
      const priceCents = soles(choice?.priceSoles ?? 0);
      if (
        !label ||
        label.length > 60 ||
        choiceIds.has(choiceId) ||
        !Number.isInteger(priceCents) ||
        priceCents < 0 ||
        priceCents > 10000
      )
        fail("Revisa el nombre y precio de cada opción.");
      choiceIds.add(choiceId);
      return { id: choiceId, label, priceCents };
    });
    if (maxSelections !== null && maxSelections > choices.length)
      fail("El límite supera la cantidad de opciones.");
    return { id, title, selectionType, required, maxSelections, choices };
  });
}

async function replaceOptions(db, scope, kitchenId, id, groups) {
  const offer = scope === "offer";
  const groupTable = offer ? "offer_option_groups" : "option_groups";
  const choiceTable = offer ? "offer_option_choices" : "option_choices";
  const where = offer ? "offer_id=?" : "kitchen_id=? AND dish_id=?";
  const args = offer ? [id] : [kitchenId, id];
  await db.execute(`DELETE FROM ${choiceTable} WHERE ${where}`, args);
  await db.execute(`DELETE FROM ${groupTable} WHERE ${where}`, args);
  for (const [sort, group] of groups.entries()) {
    if (offer) {
      await db.execute(
        "INSERT INTO offer_option_groups (offer_id,id,title,selection_type,required,max_selections,sort_order) VALUES (?,?,?,?,?,?,?)",
        [
          id,
          group.id,
          group.title,
          group.selectionType,
          group.required ? 1 : 0,
          group.maxSelections,
          sort,
        ],
      );
    } else {
      await db.execute(
        "INSERT INTO option_groups (kitchen_id,dish_id,id,title,selection_type,required,max_selections,sort_order) VALUES (?,?,?,?,?,?,?,?)",
        [
          kitchenId,
          id,
          group.id,
          group.title,
          group.selectionType,
          group.required ? 1 : 0,
          group.maxSelections,
          sort,
        ],
      );
    }
    for (const [choiceSort, choice] of group.choices.entries()) {
      if (offer) {
        await db.execute(
          "INSERT INTO offer_option_choices (offer_id,group_id,id,label,price_cents,sort_order) VALUES (?,?,?,?,?,?)",
          [
            id,
            group.id,
            choice.id,
            choice.label,
            choice.priceCents,
            choiceSort,
          ],
        );
      } else {
        await db.execute(
          "INSERT INTO option_choices (kitchen_id,dish_id,group_id,id,label,price_cents,sort_order) VALUES (?,?,?,?,?,?,?)",
          [
            kitchenId,
            id,
            group.id,
            choice.id,
            choice.label,
            choice.priceCents,
            choiceSort,
          ],
        );
      }
    }
  }
}

async function loadOptions(db, scope, kitchenId) {
  const offer = scope === "offer";
  const groupsResult = await db.execute(
    offer
      ? `SELECT g.offer_id AS parent, g.id, g.title, g.selection_type AS selectionType, g.required, g.max_selections AS maxSelections FROM offer_option_groups g JOIN offers o ON o.id=g.offer_id WHERE o.kitchen_id=? ORDER BY g.sort_order, g.id`
      : `SELECT dish_id AS parent, id, title, selection_type AS selectionType, required, max_selections AS maxSelections FROM option_groups WHERE kitchen_id=? ORDER BY sort_order, id`,
    [kitchenId],
  );
  const choicesResult = await db.execute(
    offer
      ? `SELECT c.offer_id AS parent, c.group_id AS groupId, c.id, c.label, c.price_cents AS priceCents FROM offer_option_choices c JOIN offers o ON o.id=c.offer_id WHERE o.kitchen_id=? ORDER BY c.sort_order, c.id`
      : `SELECT dish_id AS parent, group_id AS groupId, id, label, price_cents AS priceCents FROM option_choices WHERE kitchen_id=? ORDER BY sort_order, id`,
    [kitchenId],
  );
  const byParent = new Map(),
    byGroup = new Map();
  for (const row of groupsResult.rows) {
    const group = {
      id: row.id,
      title: row.title,
      selectionType: row.selectionType,
      required: bool(row.required),
      maxSelections: row.maxSelections,
      choices: [],
    };
    if (!byParent.has(row.parent)) byParent.set(row.parent, []);
    byParent.get(row.parent).push(group);
    byGroup.set(`${row.parent}:${row.id}`, group);
  }
  for (const row of choicesResult.rows)
    byGroup
      .get(`${row.parent}:${row.groupId}`)
      ?.choices.push({
        id: row.id,
        label: row.label,
        priceSoles: row.priceCents / 100,
      });
  return byParent;
}

export async function kitchenData(kitchenId) {
  const db = getDb();
  const weekStart = limaWeekStart();
  const today = todayLima();
  const twoWeeksEnd = (() => {
    const d = new Date(`${weekStart}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 14);
    return d.toISOString().slice(0, 10);
  })();
  const past28 = (() => {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 28);
    return d.toISOString().slice(0, 10);
  })();
  const future14 = (() => {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 14);
    return d.toISOString().slice(0, 10);
  })();
  // Lima 28 days ago as a datetime string for filtering created_at
  const limaRef28 = limaDateStr(
    new Date(Date.now() - 28 * 24 * 60 * 60 * 1000),
  );

  const [profile, dishes, offers, stats, hours, timeline, orders] =
    await Promise.all([
      db.execute(
        "SELECT id, name, description, logo_url AS logoUrl, image_url AS imageUrl FROM kitchens WHERE id=?",
        [kitchenId],
      ),
      db.execute(
        "SELECT id, name, description, price_cents AS priceCents, image_url AS imageUrl, image_alt AS imageAlt, active FROM dishes WHERE kitchen_id=? ORDER BY active DESC, name",
        [kitchenId],
      ),
      db.execute(
        `SELECT id, dish_id AS dishId, offer_date AS date, delivery_time AS deliveryTime, pickup_until AS pickupUntil,
        booking_deadline_at AS bookingDeadline, capacity, reserved_count AS reservedCount,
        description_override AS descriptionOverride, price_override_cents AS priceOverrideCents,
        customization_override AS hasCustomizationOverride, published_at AS publishedAt, sold_out_at AS soldOutAt
        FROM offers WHERE kitchen_id=? AND offer_date >= ? AND offer_date < ?
        ORDER BY offer_date, delivery_time, id`,
        [kitchenId, weekStart, twoWeeksEnd],
      ),
      db.execute(
        `SELECT o.id, o.dish_id AS dishId, d.name AS dishName, o.offer_date AS date, o.capacity,
        o.reserved_count AS reservedCount, o.published_at AS publishedAt, o.sold_out_at AS soldOutAt,
        COALESCE(SUM(CASE WHEN r.status='reservado' THEN i.quantity ELSE 0 END), 0) AS units,
        COALESCE(SUM(CASE WHEN r.status='reservado' THEN i.total_cents ELSE 0 END), 0) AS revenueCents,
        COUNT(DISTINCT CASE WHEN r.status='reservado' THEN r.id ELSE NULL END) AS orderCount,
        MIN(CASE WHEN r.status='reservado' THEN r.created_at ELSE NULL END) AS firstBookingAt
        FROM offers o JOIN dishes d ON d.kitchen_id=o.kitchen_id AND d.id=o.dish_id
        LEFT JOIN order_items i ON i.offer_id=o.id
        LEFT JOIN orders r ON r.id=i.order_id AND r.created_at >= ?
        WHERE o.kitchen_id=? AND o.offer_date >= ? AND o.offer_date < ?
        GROUP BY o.id, d.name ORDER BY o.offer_date DESC, o.id`,
        [limaRef28, kitchenId, past28, future14],
      ),
      db.execute(
        `SELECT CAST(strftime('%H', datetime(r.created_at, 'America/Lima')) AS INTEGER) AS hour,
        SUM(i.quantity) AS units
        FROM orders r JOIN order_items i ON i.order_id=r.id JOIN offers o ON o.id=i.offer_id
        WHERE o.kitchen_id=? AND r.status='reservado' AND r.created_at >= ?
        GROUP BY hour ORDER BY hour`,
        [kitchenId, limaRef28],
      ),
      db.execute(
        `SELECT i.offer_id AS offerId,
        strftime('%Y-%m-%d %H:00', datetime(r.created_at, 'America/Lima')) AS hour,
        SUM(i.quantity) AS units
        FROM orders r JOIN order_items i ON i.order_id=r.id JOIN offers o ON o.id=i.offer_id
        WHERE o.kitchen_id=? AND r.status='reservado' AND r.created_at >= ?
        GROUP BY i.offer_id, hour ORDER BY hour`,
        [kitchenId, limaRef28],
      ),
      db.execute(
        `SELECT COUNT(DISTINCT id) AS count FROM orders WHERE kitchen_id=? AND status='reservado' AND created_at >= ?`,
        [kitchenId, limaRef28],
      ),
    ]);

  if (!profile.rows[0]) fail("Cocina no encontrada.", 404);
  const [dishOptions, offerOptions] = await Promise.all([
    loadOptions(db, "dish", kitchenId),
    loadOptions(db, "offer", kitchenId),
  ]);
  return {
    profile: profile.rows[0],
    dishes: dishes.rows.map((row) => ({
      ...row,
      active: bool(row.active),
      priceSoles: row.priceCents / 100,
      customization: dishOptions.get(row.id) || [],
    })),
    offers: offers.rows.map((row) => ({
      ...row,
      hasCustomizationOverride: bool(row.hasCustomizationOverride),
      priceSoles:
        row.priceOverrideCents == null ? null : row.priceOverrideCents / 100,
      customization: offerOptions.get(row.id) || [],
    })),
    analytics: {
      offers: stats.rows,
      bookingHours: hours.rows,
      bookingTimeline: timeline.rows,
      totalOrders: orders.rows[0]?.count ?? 0,
    },
  };
}

export async function updateKitchen(kitchenId, data) {
  const name = text(data?.name, 40),
    description = text(data?.description, 70);
  if (name.length < 2 || name.length > 40)
    fail("El nombre de tu cocina debe tener entre 2 y 40 caracteres.");
  if (description.length > 70)
    fail("La descripción de tu cocina puede tener hasta 70 caracteres.");
  await getDb().execute(
    "UPDATE kitchens SET name=?, description=? WHERE id=?",
    [name, description, kitchenId],
  );
}

export async function saveKitchenImage(
  kitchenId,
  bytes,
  mime,
  updateLogo = true,
) {
  if (
    !["image/png", "image/jpeg"].includes(mime) ||
    bytes.length > 2_000_000 ||
    bytes.length < 20
  )
    fail("Sube una imagen PNG o JPG de hasta 2 MB.");
  const signature =
    mime === "image/png"
      ? bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))
      : bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (!signature)
    fail("El archivo no corresponde al formato de imagen indicado.");
  const id = randomUUID();
  await transaction(async (tx) => {
    await tx.execute(
      "INSERT INTO kitchen_images(id,kitchen_id,mime_type,content) VALUES (?,?,?,?)",
      [id, kitchenId, mime, bytes],
    );
    if (updateLogo)
      await tx.execute("UPDATE kitchens SET logo_url=? WHERE id=?", [
        `/api/kitchen/image/${id}`,
        kitchenId,
      ]);
  });
  return `/api/kitchen/image/${id}`;
}

export async function kitchenImage(id) {
  const result = await getDb().execute(
    "SELECT mime_type AS mime, content FROM kitchen_images WHERE id=?",
    [id],
  );
  return result.rows[0] || null;
}

export async function saveDish(kitchenId, data) {
  const id = data?.id || randomUUID(),
    name = text(data?.name, 80),
    description = text(data?.description, 90),
    imageAlt = text(data?.imageAlt, 120);
  const priceCents = soles(data?.priceSoles);
  if (
    !name ||
    name.length > 80 ||
    description.length > 90 ||
    !Number.isInteger(priceCents) ||
    priceCents < 0 ||
    priceCents > 100000 ||
    !validUrl(data?.imageUrl)
  )
    fail("Revisa el nombre, la descripción, el precio y la foto del plato.");
  const options = validateOptions(data?.customization ?? []);
  await transaction(async (tx) => {
    if (data?.id) {
      const result = await tx.execute(
        "UPDATE dishes SET name=?,description=?,price_cents=?,image_url=?,image_alt=?,active=? WHERE kitchen_id=? AND id=?",
        [
          name,
          description,
          priceCents,
          data.imageUrl,
          imageAlt || name,
          data.active !== false ? 1 : 0,
          kitchenId,
          id,
        ],
      );
      if (!result.rowsAffected) fail("Plato no encontrado.", 404);
    } else {
      await tx.execute(
        "INSERT INTO dishes(kitchen_id,id,name,description,price_cents,image_url,image_alt,active) VALUES (?,?,?,?,?,?,?,1)",
        [
          kitchenId,
          id,
          name,
          description,
          priceCents,
          data.imageUrl,
          imageAlt || name,
        ],
      );
    }
    await replaceOptions(tx, "dish", kitchenId, id, options);
  });
  return id;
}

export async function saveOffer(kitchenId, data) {
  const id = data?.id || randomUUID();
  if (!validDate(data?.date) || data.date < todayLima())
    fail("Solo puedes editar menús de hoy o de fechas futuras.");
  const offerDay = new Date(`${data.date}T12:00:00Z`).getUTCDay();
  if (offerDay === 0) fail("Los domingos no forman parte del menú semanal.");
  const monday = new Date(`${todayLima()}T12:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const end = new Date(monday);
  end.setUTCDate(end.getUTCDate() + 14);
  if (data.date >= end.toISOString().slice(0, 10))
    fail("Publica en esta semana o la siguiente.");
  if (
    !validTime(data.deliveryTime) ||
    !validTime(data.pickupUntil) ||
    data.pickupUntil <= data.deliveryTime
  )
    fail("Revisa la ventana de recojo.");
  const [startHour, startMinute] = data.deliveryTime.split(":").map(Number);
  const [endHour, endMinute] = data.pickupUntil.split(":").map(Number);
  if (endHour * 60 + endMinute - (startHour * 60 + startMinute) > 10)
    fail("La ventana de recojo puede durar como máximo 10 minutos.");
  const deadline = new Date(data.bookingDeadline);
  const pickup = new Date(`${data.date}T${data.deliveryTime}:00-05:00`);
  const capacity = Number(data.capacity);
  if (
    !Number.isFinite(deadline.getTime()) ||
    deadline >= pickup ||
    !Number.isInteger(capacity) ||
    capacity < 1 ||
    capacity > 10000
  )
    fail("Revisa el cierre de reserva y las porciones.");
  if (!data.id && (deadline <= new Date() || pickup <= new Date()))
    fail("El recojo y el cierre de reserva deben estar en el futuro.");
  const description =
    data.descriptionOverride == null || data.descriptionOverride === ""
      ? null
      : text(data.descriptionOverride, 90);
  const priceCents =
    data.priceSoles == null || data.priceSoles === ""
      ? null
      : soles(data.priceSoles);
  if (
    description?.length > 90 ||
    (priceCents !== null &&
      (!Number.isInteger(priceCents) || priceCents < 0 || priceCents > 100000))
  )
    fail("Revisa las modificaciones del menú.");
  const groups = data.hasCustomizationOverride
    ? validateOptions(data.customization ?? [])
    : null;
  const deadlineIso = deadline.toISOString();
  try {
    await transaction(async (tx) => {
      const dish = await tx.execute(
        "SELECT id, active FROM dishes WHERE kitchen_id=? AND id=?",
        [kitchenId, data.dishId],
      );
      if (!dish.rows[0]?.active) fail("Elige un plato activo de tu cocina.");
      if (data.id) {
        const existing = await tx.execute(
          `SELECT offer_date AS date, reserved_count AS reserved, dish_id AS dishId,
            delivery_time AS deliveryTime, pickup_until AS pickupUntil
            FROM offers WHERE kitchen_id=? AND id=?`,
          [kitchenId, id],
        );
        if (!existing.rows[0]) fail("Menú no encontrado.", 404);
        if (existing.rows[0].date < todayLima())
          fail("No puedes editar un menú pasado.", 403);
        if (capacity < existing.rows[0].reserved)
          fail(
            "Las porciones no pueden ser menos que las reservas confirmadas.",
          );
        if (
          existing.rows[0].reserved > 0 &&
          (existing.rows[0].date !== data.date ||
            existing.rows[0].dishId !== data.dishId ||
            existing.rows[0].deliveryTime !== data.deliveryTime ||
            existing.rows[0].pickupUntil !== data.pickupUntil)
        ) {
          fail(
            "Este menú ya tiene reservas. Conserva su plato, día y ventana de recojo.",
          );
        }
        const currentRow = (
          await tx.execute(
            "SELECT reserved_count AS reservedCount FROM offers WHERE id=?",
            [id],
          )
        ).rows[0];
        const soldOutAt =
          currentRow && currentRow.reservedCount >= capacity
            ? (
                await tx.execute("SELECT sold_out_at FROM offers WHERE id=?", [
                  id,
                ])
              ).rows[0]?.sold_out_at
            : null;
        await tx.execute(
          `UPDATE offers SET dish_id=?,offer_date=?,delivery_time=?,pickup_until=?,booking_deadline_at=?,capacity=?,description_override=?,price_override_cents=?,customization_override=?,sold_out_at=? WHERE kitchen_id=? AND id=?`,
          [
            data.dishId,
            data.date,
            data.deliveryTime,
            data.pickupUntil,
            deadlineIso,
            capacity,
            description,
            priceCents,
            groups ? 1 : 0,
            soldOutAt,
            kitchenId,
            id,
          ],
        );
      } else {
        await tx.execute(
          `INSERT INTO offers(id,kitchen_id,dish_id,offer_date,delivery_time,pickup_until,booking_deadline_at,capacity,description_override,price_override_cents,customization_override)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          [
            id,
            kitchenId,
            data.dishId,
            data.date,
            data.deliveryTime,
            data.pickupUntil,
            deadlineIso,
            capacity,
            description,
            priceCents,
            groups ? 1 : 0,
          ],
        );
      }
      await replaceOptions(tx, "offer", kitchenId, id, groups || []);
    });
  } catch (cause) {
    // SQLite UNIQUE constraint violation
    if (cause.message?.includes("UNIQUE constraint failed"))
      fail("Este plato ya está publicado para esa fecha y hora.", 409);
    throw cause;
  }
  return id;
}
