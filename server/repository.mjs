import { createHash, randomBytes, randomUUID } from "node:crypto";
import { deliveryMoment, weekStart } from "./catalog.mjs";
import { normalizeComment, selectCustomization } from "./customization.mjs";
import { getDb, transaction } from "./db.mjs";

const soles = (cents) => cents / 100;
const cents = (solesValue) => Math.round(solesValue * 100);
const invalid = (message, status = 400) =>
  Object.assign(new Error(message), { status });
const tokenHash = (token) => createHash("sha256").update(token).digest("hex");
const dishKey = (kitchenId, dishId) => `${kitchenId}:${dishId}`;
const bool = (value) => value === 1 || value === true || value === "1";

/** Build an IN-clause placeholder string and flatten args for libSQL. */
function inClause(values) {
  return { placeholder: values.map(() => "?").join(","), args: values };
}

async function loadDishes(db) {
  const dishesResult = await db.execute(
    "SELECT kitchen_id AS kitchenId, id, name, description, price_cents AS priceCents, image_url AS imageUrl, image_alt AS imageAlt, active FROM dishes",
  );
  const groupsResult = await db.execute(
    "SELECT kitchen_id AS kitchenId, dish_id AS dishId, id, title, selection_type AS selectionType, required, max_selections AS maxSelections FROM option_groups ORDER BY sort_order, id",
  );
  const choicesResult = await db.execute(
    "SELECT kitchen_id AS kitchenId, dish_id AS dishId, group_id AS groupId, id, label, price_cents AS priceCents FROM option_choices ORDER BY sort_order, id",
  );
  const dishes = new Map(
    dishesResult.rows.map((row) => [
      dishKey(row.kitchenId, row.id),
      {
        ...row,
        active: bool(row.active),
        priceSoles: soles(row.priceCents),
        customization: [],
      },
    ]),
  );
  const groups = new Map();
  for (const row of groupsResult.rows) {
    const dish = dishes.get(dishKey(row.kitchenId, row.dishId));
    if (!dish) continue;
    const group = {
      id: row.id,
      title: row.title,
      selectionType: row.selectionType,
      required: bool(row.required),
      maxSelections: row.maxSelections,
      choices: [],
    };
    dish.customization.push(group);
    groups.set(`${row.kitchenId}:${row.dishId}:${row.id}`, group);
  }
  for (const row of choicesResult.rows)
    groups
      .get(`${row.kitchenId}:${row.dishId}:${row.groupId}`)
      ?.choices.push({
        id: row.id,
        label: row.label,
        priceSoles: soles(row.priceCents),
      });
  return dishes;
}

async function loadOfferOptions(db, ids) {
  if (!ids.length) return new Map();
  const { placeholder, args } = inClause(ids);
  const [groupsResult, choicesResult] = await Promise.all([
    db.execute(
      `SELECT offer_id AS offerId, id, title, selection_type AS selectionType, required, max_selections AS maxSelections FROM offer_option_groups WHERE offer_id IN (${placeholder}) ORDER BY sort_order, id`,
      args,
    ),
    db.execute(
      `SELECT offer_id AS offerId, group_id AS groupId, id, label, price_cents AS priceCents FROM offer_option_choices WHERE offer_id IN (${placeholder}) ORDER BY sort_order, id`,
      args,
    ),
  ]);
  const offers = new Map(),
    groups = new Map();
  for (const row of groupsResult.rows) {
    if (!offers.has(row.offerId)) offers.set(row.offerId, []);
    const group = {
      id: row.id,
      title: row.title,
      selectionType: row.selectionType,
      required: bool(row.required),
      maxSelections: row.maxSelections,
      choices: [],
    };
    offers.get(row.offerId).push(group);
    groups.set(`${row.offerId}:${row.id}`, group);
  }
  for (const row of choicesResult.rows)
    groups
      .get(`${row.offerId}:${row.groupId}`)
      ?.choices.push({
        id: row.id,
        label: row.label,
        priceSoles: soles(row.priceCents),
      });
  return offers;
}

export async function getCatalog(now = new Date()) {
  const db = getDb();
  const start = weekStart(now);
  const nextStart = new Date(`${start}T12:00:00Z`);
  nextStart.setUTCDate(nextStart.getUTCDate() + 7);
  const next = nextStart.toISOString().slice(0, 10);
  const twoWeeksEnd = new Date(`${start}T12:00:00Z`);
  twoWeeksEnd.setUTCDate(twoWeeksEnd.getUTCDate() + 14);
  const twoWeeksEndStr = twoWeeksEnd.toISOString().slice(0, 10);

  const [
    kitchensResult,
    offersResult,
    dishes,
    salesResult,
    weeklyDishSalesResult,
    ratingsResult,
  ] = await Promise.all([
    db.execute(
      "SELECT id, name, description, image_url AS imageUrl, logo_url AS logoUrl, test_account AS testAccount FROM kitchens ORDER BY name",
    ),
    db.execute(
      `SELECT id, kitchen_id AS kitchenId, dish_id AS dishId, offer_date AS date,
      delivery_time AS deliveryTime, pickup_until AS pickupUntil,
      booking_deadline_at AS bookingDeadline,
      CASE WHEN booking_deadline_at > datetime('now') THEN 1 ELSE 0 END AS withinBookingWindow,
      capacity, reserved_count AS reservedCount, sort_order AS sortOrder,
      description_override AS descriptionOverride, price_override_cents AS priceOverrideCents,
      customization_override AS customizationOverride
      FROM offers WHERE offer_date >= ? AND offer_date < ? ORDER BY offer_date, sort_order, id`,
      [start, twoWeeksEndStr],
    ),
    loadDishes(db),
    db.execute(`SELECT f.kitchen_id AS kitchenId, f.dish_id AS dishId, SUM(i.quantity) AS units
      FROM order_items i JOIN orders o ON o.id=i.order_id JOIN offers f ON f.id=i.offer_id
      WHERE o.status='reservado' AND o.fulfillment_status='delivered'
      GROUP BY f.kitchen_id, f.dish_id ORDER BY units DESC, f.kitchen_id, f.dish_id`),
    db.execute(
      `SELECT CASE WHEN f.offer_date < ? THEN 0 ELSE 1 END AS week,
      f.kitchen_id AS kitchenId, f.dish_id AS dishId, SUM(i.quantity) AS units,
      COUNT(DISTINCT o.id) AS orderCount
      FROM order_items i JOIN orders o ON o.id=i.order_id JOIN offers f ON f.id=i.offer_id
      WHERE f.offer_date >= ? AND f.offer_date < ?
        AND o.status='reservado' AND o.fulfillment_status != 'no_show'
      GROUP BY week, f.kitchen_id, f.dish_id
      ORDER BY week, units DESC, orderCount DESC, f.kitchen_id, f.dish_id`,
      [next, start, twoWeeksEndStr],
    ),
    db.execute(`SELECT o.kitchen_id AS kitchenId, ROUND(AVG(r.kitchen_rating), 1) AS rating,
      COUNT(*) AS ratingCount
      FROM order_reviews r JOIN orders o ON o.id=r.order_id
      WHERE o.status='reservado' AND o.fulfillment_status='delivered' GROUP BY o.kitchen_id`),
  ]);

  const kitchenNames = new Map(
    kitchensResult.rows.map((kitchen) => [kitchen.id, kitchen.name]),
  );
  const offerOptions = await loadOfferOptions(
    db,
    offersResult.rows
      .filter((row) => bool(row.customizationOverride))
      .map((row) => row.id),
  );
  const kitchenRatings = new Map(
    ratingsResult.rows.map((row) => [row.kitchenId, row]),
  );

  return {
    kitchens: kitchensResult.rows.map((kitchen) => ({
      ...kitchen,
      testAccount: bool(kitchen.testAccount),
      rating: kitchenRatings.get(kitchen.id)?.rating ?? null,
      ratingCount: kitchenRatings.get(kitchen.id)?.ratingCount ?? 0,
    })),
    sales: salesResult.rows,
    weeklyDishSales: weeklyDishSalesResult.rows,
    weeks: [start, next],
    offerings: offersResult.rows.flatMap((row) => {
      const dish = dishes.get(dishKey(row.kitchenId, row.dishId));
      if (!dish) return [];
      const remaining = row.capacity - row.reservedCount;
      const {
        withinBookingWindow,
        descriptionOverride,
        priceOverrideCents,
        customizationOverride,
        ...offer
      } = row;
      return [
        {
          ...dish,
          ...offer,
          description: descriptionOverride ?? dish.description,
          priceCents: priceOverrideCents ?? dish.priceCents,
          priceSoles: soles(priceOverrideCents ?? dish.priceCents),
          customization: bool(customizationOverride)
            ? offerOptions.get(row.id) || []
            : dish.customization,
          kitchenName: kitchenNames.get(row.kitchenId) || "",
          remaining,
          bookable: remaining > 0 && bool(withinBookingWindow),
          week: row.date >= next ? 1 : 0,
        },
      ];
    }),
  };
}

export async function findUserByEmail(email) {
  const result = await getDb().execute(
    `SELECT u.id, u.name, u.email, u.role, u.kitchen_id AS kitchenId, u.student_code AS studentCode,
      u.career, u.birth_date AS birthDate, u.password_hash AS passwordHash,
      NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id=u.id AND o.status='reservado' AND o.fulfillment_status='no_show') AS bookingAllowed
      FROM users u WHERE u.email=?`,
    [email],
  );
  const row = result.rows[0];
  if (!row) return null;
  return { ...row, bookingAllowed: bool(row.bookingAllowed) };
}

export async function insertUser(user) {
  await getDb().execute(
    `INSERT INTO users (id, name, email, password_hash, role, student_code, career, birth_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user.id,
      user.name,
      user.email,
      user.passwordHash,
      user.role,
      user.studentCode,
      user.career,
      user.birthDate || null,
    ],
  );
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    kitchenId: null,
    studentCode: user.studentCode,
    career: user.career,
    birthDate: user.birthDate || null,
    bookingAllowed: true,
  };
}

export async function userFromSession(token) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const result = await getDb().execute(
    `SELECT u.id, u.name, u.email, u.role, u.kitchen_id AS kitchenId, u.student_code AS studentCode,
      u.career, u.birth_date AS birthDate,
      NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id=u.id AND o.status='reservado' AND o.fulfillment_status='no_show') AS bookingAllowed
      FROM sessions s JOIN users u ON u.id=s.user_id
      WHERE s.token_hash=? AND s.expires_at > datetime('now')`,
    [tokenHash(token)],
  );
  const row = result.rows[0];
  if (!row) return null;
  return { ...row, bookingAllowed: bool(row.bookingAllowed) };
}

export async function updateConsumerProfile(
  userId,
  { name, studentCode, career, birthDate },
) {
  const result = await getDb().execute(
    `UPDATE users SET name=?, student_code=?, career=?, birth_date=? WHERE id=? AND role='consumer'`,
    [name, studentCode, career, birthDate, userId],
  );
  return result.rowsAffected > 0;
}

export async function insertSession(token, userId) {
  await getDb().execute(
    `INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, datetime('now', '+7 days'))`,
    [tokenHash(token), userId],
  );
}

export async function removeSession(token) {
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    await getDb().execute("DELETE FROM sessions WHERE token_hash=?", [
      tokenHash(token),
    ]);
  }
}

export async function getOrders(userId) {
  const ordersResult = await getDb().execute(
    `SELECT o.id, o.code, o.kitchen_id AS kitchenId, o.kitchen_name AS kitchenName,
      o.offer_date AS date, o.delivery_time AS deliveryTime,
      o.pickup_until AS pickupUntil, o.pickup_point AS pickupPoint,
      o.status, o.payment, o.fulfillment_status AS fulfillmentStatus,
      o.review_enabled AS reviewEnabled, r.kitchen_rating AS kitchenRating,
      o.total_cents AS totalCents, o.created_at AS createdAt
      FROM orders o LEFT JOIN order_reviews r ON r.order_id=o.id
      WHERE o.user_id=? ORDER BY o.created_at DESC`,
    [userId],
  );
  if (!ordersResult.rows.length) return [];
  const ids = ordersResult.rows.map((row) => row.id);
  const { placeholder, args } = inClause(ids);
  const [itemsResult, choicesResult] = await Promise.all([
    getDb().execute(
      `SELECT i.id, i.order_id AS orderId, i.offer_id AS offeringId, i.dish_name AS name,
        i.image_url AS imageUrl, i.quantity, i.comment,
        i.unit_price_cents AS unitPriceCents, i.total_cents AS totalCents,
        r.food_rating AS foodRating
        FROM order_items i LEFT JOIN order_item_reviews r ON r.order_item_id=i.id
        WHERE i.order_id IN (${placeholder}) ORDER BY i.sort_order, i.id`,
      args,
    ),
    getDb().execute(
      `SELECT c.order_item_id AS itemId, c.group_id AS groupId, c.group_title AS title,
        c.choice_id AS choiceId, c.choice_label AS label, c.price_cents AS priceCents
        FROM order_item_choices c JOIN order_items i ON i.id=c.order_item_id
        WHERE i.order_id IN (${placeholder}) ORDER BY c.sort_order, c.choice_id`,
      args,
    ),
  ]);
  const choices = new Map();
  for (const row of choicesResult.rows) {
    if (!choices.has(row.itemId)) choices.set(row.itemId, []);
    choices
      .get(row.itemId)
      .push({
        groupId: row.groupId,
        title: row.title,
        choiceId: row.choiceId,
        label: row.label,
        priceSoles: soles(row.priceCents),
      });
  }
  const items = new Map();
  for (const row of itemsResult.rows) {
    if (!items.has(row.orderId)) items.set(row.orderId, []);
    items
      .get(row.orderId)
      .push({
        id: String(row.id),
        offeringId: row.offeringId,
        name: row.name,
        imageUrl: row.imageUrl,
        quantity: row.quantity,
        comment: row.comment,
        choices: choices.get(row.id) || [],
        unitPriceSoles: soles(row.unitPriceCents),
        totalSoles: soles(row.totalCents),
        foodRating: row.foodRating,
      });
  }
  return ordersResult.rows.map((row) => ({
    id: row.id,
    code: row.code,
    kitchenName: row.kitchenName,
    date: row.date,
    deliveryTime: row.deliveryTime,
    pickupUntil: row.pickupUntil,
    pickupPoint: row.pickupPoint,
    status: row.status,
    payment: row.payment,
    fulfillmentStatus: row.fulfillmentStatus,
    reviewEnabled: bool(row.reviewEnabled),
    kitchenRating: row.kitchenRating,
    totalSoles: soles(row.totalCents),
    createdAt: row.createdAt,
    items: items.get(row.id) || [],
  }));
}

export async function submitReview(userId, orderId, payload, now = new Date()) {
  const kitchenRating = Number(payload?.kitchenRating);
  const foodRatings = payload?.foodRatings;
  if (
    !Number.isInteger(kitchenRating) ||
    kitchenRating < 1 ||
    kitchenRating > 5
  )
    throw invalid("Califica la cocina de 1 a 5 estrellas.");
  if (
    !Array.isArray(foodRatings) ||
    foodRatings.length < 1 ||
    foodRatings.some(
      (value) =>
        !value ||
        typeof value.orderItemId !== "string" ||
        !Number.isInteger(value.rating) ||
        value.rating < 1 ||
        value.rating > 5,
    )
  )
    throw invalid("Califica cada plato de 1 a 5 estrellas.");
  return transaction(async (tx) => {
    const orderResult = await tx.execute(
      `SELECT id, status, fulfillment_status AS fulfillmentStatus, review_enabled AS reviewEnabled,
        offer_date AS date, delivery_time AS deliveryTime
        FROM orders WHERE id=? AND user_id=?`,
      [orderId, userId],
    );
    const order = orderResult.rows[0];
    if (!order) throw invalid("Pedido no encontrado.", 404);
    if (
      order.status !== "reservado" ||
      order.fulfillmentStatus !== "delivered" ||
      !bool(order.reviewEnabled) ||
      deliveryMoment(order.date, order.deliveryTime) > now
    )
      throw invalid("Este pedido aún no está habilitado para reseñas.", 403);
    const existingReview = await tx.execute(
      "SELECT 1 FROM order_reviews WHERE order_id=?",
      [orderId],
    );
    if (existingReview.rows.length)
      throw invalid("Ya calificaste este pedido.", 409);
    const itemsResult = await tx.execute(
      "SELECT CAST(id AS TEXT) AS id FROM order_items WHERE order_id=? ORDER BY id",
      [orderId],
    );
    const actual = itemsResult.rows.map((row) => row.id).sort();
    const submitted = foodRatings.map((row) => row.orderItemId).sort();
    if (
      actual.length !== submitted.length ||
      actual.some((id, index) => id !== submitted[index])
    )
      throw invalid("Califica todos los platos del pedido una sola vez.");
    await tx.execute(
      "INSERT INTO order_reviews (order_id, kitchen_rating) VALUES (?, ?)",
      [orderId, kitchenRating],
    );
    for (const value of foodRatings) {
      await tx.execute(
        "INSERT INTO order_item_reviews (order_item_id, order_id, food_rating) VALUES (?, ?, ?)",
        [value.orderItemId, orderId, value.rating],
      );
    }
    return { ok: true };
  });
}

export async function createBooking(userId, payload, requestKey = null) {
  if (!Array.isArray(payload) || payload.length < 1 || payload.length > 20)
    throw invalid("Agrega al menos un plato al carrito.");
  if (
    payload.some(
      (item) =>
        !item ||
        typeof item !== "object" ||
        Array.isArray(item) ||
        typeof item.offeringId !== "string" ||
        !item.offeringId,
    )
  )
    throw invalid("Hay un plato inválido en el carrito.");
  if (
    requestKey !== null &&
    (typeof requestKey !== "string" ||
      !/^[a-zA-Z0-9_-]{8,128}$/.test(requestKey))
  )
    throw invalid("Identificador de solicitud inválido.");
  return transaction(async (tx) => {
    if (requestKey) {
      const payloadHash = createHash("sha256")
        .update(JSON.stringify(payload))
        .digest("hex");
      try {
        await tx.execute(
          "INSERT INTO booking_requests (user_id, request_key, payload_hash) VALUES (?, ?, ?)",
          [userId, requestKey, payloadHash],
        );
      } catch (e) {
        // Duplicate key — check existing
        const existing = await tx.execute(
          "SELECT payload_hash, response FROM booking_requests WHERE user_id=? AND request_key=?",
          [userId, requestKey],
        );
        if (existing.rows[0]?.payload_hash !== payloadHash)
          throw invalid("La solicitud ya se usó con otro carrito.", 409);
        if (!existing.rows[0]?.response)
          throw invalid(
            "La reserva sigue en proceso. Intenta nuevamente.",
            409,
          );
        return JSON.parse(existing.rows[0].response);
      }
    }

    const noShow = await tx.execute(
      `SELECT 1 FROM orders WHERE user_id=? AND status='reservado' AND fulfillment_status='no_show' LIMIT 1`,
      [userId],
    );
    if (noShow.rows.length)
      throw invalid(
        "No puedes confirmar otra reserva mientras tengas un pedido marcado como no recogido.",
        403,
      );

    const ids = [...new Set(payload.map((item) => item.offeringId))].sort();
    const { placeholder, args } = inClause(ids);
    const offersResult = await tx.execute(
      `SELECT id, kitchen_id AS kitchenId, dish_id AS dishId,
        offer_date AS date, delivery_time AS deliveryTime, pickup_until AS pickupUntil,
        booking_deadline_at AS bookingDeadline,
        CASE WHEN booking_deadline_at > datetime('now') THEN 1 ELSE 0 END AS withinBookingWindow,
        capacity, reserved_count AS reservedCount,
        price_override_cents AS priceOverrideCents,
        customization_override AS customizationOverride
        FROM offers WHERE id IN (${placeholder}) ORDER BY id`,
      args,
    );
    const offers = new Map(offersResult.rows.map((row) => [row.id, row]));
    const offerOptions = await loadOfferOptions(
      tx,
      offersResult.rows
        .filter((row) => bool(row.customizationOverride))
        .map((row) => row.id),
    );
    const dishes = await loadDishes(tx);
    const kitchensResult = await tx.execute("SELECT id, name FROM kitchens");
    const kitchenNames = new Map(
      kitchensResult.rows.map((row) => [row.id, row.name]),
    );
    const requested = new Map();

    const items = payload.map((item) => {
      const offer = offers.get(item.offeringId);
      if (!offer || !bool(offer.withinBookingWindow))
        throw invalid(
          "El plazo de reserva de uno de los platos ya terminó.",
          409,
        );
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10)
        throw invalid("La cantidad debe estar entre 1 y 10.");
      requested.set(offer.id, (requested.get(offer.id) || 0) + quantity);
      if (offer.reservedCount + requested.get(offer.id) > offer.capacity)
        throw invalid(
          `Ya no quedan suficientes porciones de ${dishes.get(dishKey(offer.kitchenId, offer.dishId))?.name || "este plato"}.`,
          409,
        );
      const dish = dishes.get(dishKey(offer.kitchenId, offer.dishId));
      if (!dish) throw invalid("Uno de los menús ya no está disponible.", 409);
      const selections = selectCustomization(
        bool(offer.customizationOverride)
          ? offerOptions.get(offer.id) || []
          : dish.customization,
        item.choices,
      );
      const comment = normalizeComment(item.comment);
      const unitPriceCents =
        (offer.priceOverrideCents ?? dish.priceCents) +
        selections.reduce((sum, choice) => sum + cents(choice.priceSoles), 0);
      return {
        offeringId: offer.id,
        name: dish.name,
        imageUrl: dish.imageUrl,
        quantity,
        comment,
        choices: selections,
        unitPriceCents,
        totalCents: unitPriceCents * quantity,
        kitchenId: offer.kitchenId,
        kitchenName: kitchenNames.get(offer.kitchenId) || "",
        date: offer.date,
        deliveryTime: offer.deliveryTime,
        pickupUntil: offer.pickupUntil,
      };
    });

    for (const id of ids) {
      const qty = requested.get(id);
      // Check constraints before updating
      const check = await tx.execute(
        `SELECT reserved_count AS reservedCount, capacity, booking_deadline_at AS bookingDeadline FROM offers WHERE id=?`,
        [id],
      );
      const row = check.rows[0];
      if (
        !row ||
        row.reservedCount + qty > row.capacity ||
        row.bookingDeadline <= new Date().toISOString()
      ) {
        throw invalid(
          "El plazo de reserva terminó o se agotaron las porciones de uno de los platos.",
          409,
        );
      }
      const soldOutAt =
        row.reservedCount + qty === row.capacity
          ? new Date().toISOString()
          : null;
      await tx.execute(
        `UPDATE offers SET reserved_count=reserved_count+?, sold_out_at=COALESCE(?, sold_out_at) WHERE id=?`,
        [qty, soldOutAt, id],
      );
    }

    const groups = new Map();
    for (const item of items) {
      const key = `${item.kitchenId}:${item.date}:${item.deliveryTime}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }

    const created = [];
    for (const group of groups.values()) {
      const order = {
        id: randomUUID(),
        code: `MU-${randomBytes(4).toString("hex").toUpperCase()}`,
        userId,
        kitchenId: group[0].kitchenId,
        kitchenName: group[0].kitchenName,
        date: group[0].date,
        deliveryTime: group[0].deliveryTime,
        pickupUntil: group[0].pickupUntil,
        pickupPoint: "Comedor UTEC",
        status: "reservado",
        payment: "QR al recibir",
        totalCents: group.reduce((sum, item) => sum + item.totalCents, 0),
        createdAt: new Date().toISOString(),
      };
      await tx.execute(
        `INSERT INTO orders (id,code,user_id,kitchen_id,kitchen_name,offer_date,delivery_time,pickup_until,pickup_point,status,payment,total_cents,created_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          order.id,
          order.code,
          userId,
          order.kitchenId,
          order.kitchenName,
          order.date,
          order.deliveryTime,
          order.pickupUntil,
          order.pickupPoint,
          order.status,
          order.payment,
          order.totalCents,
          order.createdAt,
        ],
      );
      const visibleItems = [];
      for (const [index, item] of group.entries()) {
        const saved = await tx.execute(
          `INSERT INTO order_items (order_id,offer_id,dish_name,image_url,quantity,comment,unit_price_cents,total_cents,sort_order)
            VALUES (?,?,?,?,?,?,?,?,?)`,
          [
            order.id,
            item.offeringId,
            item.name,
            item.imageUrl,
            item.quantity,
            item.comment,
            item.unitPriceCents,
            item.totalCents,
            index,
          ],
        );
        const itemId = saved.lastInsertRowid;
        for (const [choiceIndex, choice] of item.choices.entries()) {
          await tx.execute(
            `INSERT INTO order_item_choices (order_item_id,group_id,group_title,choice_id,choice_label,price_cents,sort_order)
              VALUES (?,?,?,?,?,?,?)`,
            [
              itemId,
              choice.groupId,
              choice.title,
              choice.choiceId,
              choice.label,
              cents(choice.priceSoles),
              choiceIndex,
            ],
          );
        }
        visibleItems.push({
          offeringId: item.offeringId,
          name: item.name,
          imageUrl: item.imageUrl,
          quantity: item.quantity,
          comment: item.comment,
          choices: item.choices,
          unitPriceSoles: soles(item.unitPriceCents),
          totalSoles: soles(item.totalCents),
        });
      }
      created.push({
        id: order.id,
        code: order.code,
        kitchenName: order.kitchenName,
        date: order.date,
        deliveryTime: order.deliveryTime,
        pickupUntil: order.pickupUntil,
        pickupPoint: order.pickupPoint,
        status: order.status,
        payment: order.payment,
        totalSoles: soles(order.totalCents),
        createdAt: order.createdAt,
        items: visibleItems,
      });
    }

    if (requestKey) {
      await tx.execute(
        "UPDATE booking_requests SET response=? WHERE user_id=? AND request_key=?",
        [JSON.stringify(created), userId, requestKey],
      );
    }
    return created;
  });
}
