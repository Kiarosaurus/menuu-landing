import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createServer } from "node:http";

if (!process.env.MENUU_TEST_DB_PATH) {
  const directory = await mkdtemp(join(tmpdir(), "menuu-libsql-"));

  try {
    const code = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [fileURLToPath(import.meta.url)], {
        stdio: "inherit",
        env: {
          ...process.env,
          MENUU_TEST_DB_PATH: join(directory, "consumer.db"),
        },
      });

      child.on("error", reject);
      child.on("exit", (value) => resolve(value || 0));
    });

    if (code) process.exitCode = code;
  } finally {
    if (
      !resolve(directory).startsWith(`${resolve(tmpdir())}${sep}`) ||
      !basename(directory).startsWith("menuu-libsql-")
    )
      throw new Error("Ruta temporal inesperada.");
    await rm(directory, { recursive: true, force: true });
  }
} else {
  process.env.TURSO_DATABASE_URL = `file:${process.env.MENUU_TEST_DB_PATH}`;
  delete process.env.TURSO_AUTH_TOKEN;

  const { migrate } = await import("./migrate.mjs");
  const { closeDb, getDb } = await import("../server/db.mjs");
  const { weekStart } = await import("../server/catalog.mjs");
  const { hashPassword } = await import("../server/store.mjs");
  const { createBooking, getCatalog, getOrders, insertUser, submitReview } =
    await import("../server/repository.mjs");
  const { kitchenData, kitchenImage, saveDish, saveKitchenImage, saveOffer } =
    await import("../server/kitchen.mjs");
  const {
    addKitchenReservation,
    kitchenStudentCandidates,
    updateKitchenReservation,
  } = await import("../server/kitchen.mjs");
  const { handleRequest } = await import("../server/index.mjs");

  try {
    const migrationDb = getDb();
    await migrationDb.query(
      "CREATE TABLE schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))",
    );
    const initialSql = await readFile(
      fileURLToPath(
        new URL("../server/migrations/0001_initial.sql", import.meta.url),
      ),
      "utf8",
    );
    for (const statement of initialSql
      .split(/;\s*(?:\r?\n|$)/)
      .map((value) => value.trim())
      .filter(Boolean))
      await migrationDb.query(statement);
    await migrationDb.query(
      "INSERT INTO schema_migrations(name) VALUES ('0001_initial.sql')",
    );
    await migrationDb.query(
      "INSERT INTO users(id,name,email,password_hash,role,student_code,career) VALUES ('before-migration','Estudiante anterior','anterior@utec.edu.pe','hash','consumer','800000001','Ingeniería')",
    );
    await migrationDb.query(
      "INSERT INTO kitchens(id,name) VALUES ('old-kitchen','Cocina anterior')",
    );
    await migrationDb.query(
      "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES ('old-session','before-migration','2099-01-01')",
    );
    await migrationDb.query(
      "INSERT INTO orders(id,code,user_id,kitchen_id,kitchen_name,offer_date,delivery_time,pickup_until,pickup_point,status,payment,total_cents) VALUES ('old-order','MU-OLD','before-migration','old-kitchen','Cocina anterior','2020-01-01','13:00','13:10','Comedor UTEC','reservado','QR al recibir',1100)",
    );
    await migrate();
    await migrate();
    const db = getDb();
    assert.equal(
      (
        await db.query(
          "SELECT user_id FROM sessions WHERE token_hash='old-session'",
        )
      ).rows[0].user_id,
      "before-migration",
    );
    assert.equal((await db.query("PRAGMA foreign_key_check")).rows.length, 0);
    assert.equal(
      (await db.query("SELECT pickup_point FROM orders WHERE id='old-order'"))
        .rows[0].pickup_point,
      "Entrada del Comedor UTEC en piso 2",
    );

    await db.query(
      "INSERT INTO kitchens(id,name,description) VALUES ($1,$2,$3)",
      ["test-kitchen", "Cocina temporal", "Para probar reservas"],
    );
    const consumers = [0, 1].map((index) => ({
      id: randomUUID(),
      name: `Estudiante ${index}`,
      email: `temporal${index}@utec.edu.pe`,
      passwordHash: hashPassword("clave-para-test"),
      role: "consumer",
      studentCode: `90000000${index}`,
      career: "Ciencia de la Computación",
      birthDate: null,
    }));

    for (const consumer of consumers) await insertUser(consumer);
    const dishId = await saveDish("test-kitchen", {
      name: "Almuerzo temporal",
      description: "Con arroz.",
      priceSoles: 11,
      imageUrl: "/images/menuu-logo.png",
      customization: [],
    });
    const date = new Date(`${weekStart()}T12:00:00Z`);

    date.setUTCDate(date.getUTCDate() + 7);
    const offerDate = date.toISOString().slice(0, 10);
    const offerId = await saveOffer("test-kitchen", {
      dishId,
      date: offerDate,
      deliveryTime: "13:00",
      pickupUntil: "13:10",
      bookingDeadline: `${offerDate}T12:00:00-05:00`,
      capacity: 1,
    });
    const catalog = await getCatalog();

    assert.equal(catalog.offerings.length, 1);
    assert.equal(catalog.offerings[0].bookable, true);
    const first = await createBooking(
      consumers[0].id,
      [{ offeringId: offerId, quantity: 1, choices: {}, comment: "Sin ají" }],
      "request-test-001",
    );

    assert.equal(first.length, 1);
    assert.deepEqual(
      await createBooking(
        consumers[0].id,
        [{ offeringId: offerId, quantity: 1, choices: {}, comment: "Sin ají" }],
        "request-test-001",
      ),
      first,
    );
    await assert.rejects(
      () =>
        createBooking(
          consumers[1].id,
          [{ offeringId: offerId, quantity: 1, choices: {} }],
          "request-test-002",
        ),
      { status: 409 },
    );
    assert.equal((await getCatalog()).offerings[0].remaining, 0);
    assert.equal((await getOrders(consumers[0].id)).length, 1);
    const secondDate = new Date(`${offerDate}T12:00:00Z`);

    secondDate.setUTCDate(secondDate.getUTCDate() + 1);
    const nextDay = secondDate.toISOString().slice(0, 10);
    const concurrentOffer = await saveOffer("test-kitchen", {
      dishId,
      date: nextDay,
      deliveryTime: "13:00",
      pickupUntil: "13:10",
      bookingDeadline: `${nextDay}T12:00:00-05:00`,
      capacity: 1,
    });
    const simultaneous = await Promise.allSettled(
      consumers.map((consumer, index) =>
        createBooking(
          consumer.id,
          [{ offeringId: concurrentOffer, quantity: 1, choices: {} }],
          `parallel-${index}-request`,
        ),
      ),
    );

    assert.equal(
      simultaneous.filter((outcome) => outcome.status === "fulfilled").length,
      1,
    );
    assert.equal(
      simultaneous.filter(
        (outcome) =>
          outcome.status === "rejected" && outcome.reason.status === 409,
      ).length,
      1,
    );
    assert.equal(
      (
        await db.query(
          "SELECT reserved_count AS reserved FROM offers WHERE id=$1",
          [concurrentOffer],
        )
      ).rows[0].reserved,
      1,
    );
    const data = await kitchenData("test-kitchen");

    assert.equal(data.analytics.totalOrders, 2);
    assert.equal(data.offers[0].reservedCount, 1);
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRj0AAAAASUVORK5CYII=",
      "base64",
    );
    const imageUrl = await saveKitchenImage("test-kitchen", png, "image/png");

    assert.deepEqual(
      Buffer.from((await kitchenImage(imageUrl.split("/").at(-1))).content),
      png,
    );
    const order = (await getOrders(consumers[0].id)).find(
      (value) => value.id === first[0].id,
    );

    await db.query(
      "UPDATE orders SET fulfillment_status=$2,review_enabled=$3 WHERE id=$1",
      [order.id, "delivered", true],
    );
    await submitReview(
      consumers[0].id,
      order.id,
      {
        kitchenRating: 5,
        foodRatings: [{ orderItemId: String(order.items[0].id), rating: 4 }],
      },
      new Date(`${offerDate}T14:00:00-05:00`),
    );
    assert.equal(
      (await getCatalog()).kitchens.find((item) => item.id === "test-kitchen")
        .rating,
      5,
    );
    const server = createServer(handleRequest);

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const base = `http://127.0.0.1:${server.address().port}`;
      const registered = await fetch(`${base}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Nueva estudiante",
          email: "nueva@utec.edu.pe",
          password: "clave-segura",
          studentCode: "900000002",
          career: "Ciencia de la Computación",
        }),
      });

      assert.equal(registered.status, 201);
      const cookie = registered.headers.get("set-cookie").split(";")[0];
      const bootstrap = await fetch(`${base}/api/bootstrap`, {
        headers: { Cookie: cookie },
      });

      assert.equal(bootstrap.status, 200);
      assert.equal((await bootstrap.json()).user.email, "nueva@utec.edu.pe");
      const preRegistered = await fetch(`${base}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Estudiante PRE",
          email: "pre@utec.edu.pe",
          password: "clave-segura",
          studentCode: "1234pre5612345",
          career: "Ciencia de la Computación",
        }),
      });
      assert.equal(preRegistered.status, 201);
      assert.equal(
        (await preRegistered.json()).user.studentCode,
        "1234PRE5612345",
      );
      const invalidPre = await fetch(`${base}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Código inválido",
          email: "invalido@utec.edu.pe",
          password: "clave-segura",
          studentCode: "1234PREX612345",
          career: "Ciencia de la Computación",
        }),
      });
      assert.equal(invalidPre.status, 400);
      const preUser = (
        await db.query("SELECT id FROM users WHERE email='pre@utec.edu.pe'")
      ).rows[0];
      await db.query(
        "INSERT INTO users(id,name,email,password_hash,role,kitchen_id) VALUES ('kitchen-actor','Cocina temporal','cocina@menuu.test','hash','kitchen','test-kitchen')",
      );
      await db.query("UPDATE offers SET capacity=2 WHERE id=$1", [offerId]);
      const candidates = await kitchenStudentCandidates(
        "test-kitchen",
        offerId,
        "pre@",
      );
      assert.equal(
        candidates.some((student) => student.id === preUser.id),
        true,
      );
      await assert.rejects(
        kitchenStudentCandidates("another-kitchen", offerId, "pre@"),
        { status: 404 },
      );
      const manual = await addKitchenReservation(
        "test-kitchen",
        "kitchen-actor",
        {
          offerId,
          studentId: preUser.id,
          quantity: 1,
        },
      );
      assert.equal(
        (await kitchenStudentCandidates("test-kitchen", offerId, "pre@")).some(
          (student) => student.id === preUser.id,
        ),
        false,
      );
      assert.equal(
        (
          await db.query("SELECT reserved_count FROM offers WHERE id=$1", [
            offerId,
          ])
        ).rows[0].reserved_count,
        2,
      );
      await updateKitchenReservation("test-kitchen", "kitchen-actor", {
        orderId: manual.orderId,
        action: "confirm",
      });
      await updateKitchenReservation("test-kitchen", "kitchen-actor", {
        orderId: manual.orderId,
        action: "payment",
        paymentMethod: "Efectivo",
      });
      await updateKitchenReservation("test-kitchen", "kitchen-actor", {
        orderId: manual.orderId,
        action: "deliver",
      });
      const manualOrder = (await getOrders(preUser.id)).find(
        (order) => order.id === manual.orderId,
      );
      assert.equal(
        (await kitchenData("test-kitchen")).reservations.some(
          (item) =>
            item.orderId === manual.orderId &&
            item.studentEmail === "pre@utec.edu.pe",
        ),
        true,
      );
      await assert.rejects(
        updateKitchenReservation("another-kitchen", "kitchen-actor", {
          orderId: manual.orderId,
          action: "reset",
        }),
        { status: 404 },
      );
      assert.equal(manualOrder.fulfillmentStatus, "delivered");
      assert.equal(manualOrder.payment, "Efectivo");
      assert.equal(
        manualOrder.pickupPoint,
        "Entrada del Comedor UTEC en piso 2",
      );
      await assert.rejects(
        updateKitchenReservation("test-kitchen", "kitchen-actor", {
          orderId: first[0].id,
          action: "cancel",
        }),
        /Espera hasta que termine/,
      );
      await db.query(
        "UPDATE orders SET offer_date='2020-01-01',pickup_until='13:10',created_at='2020-01-01T12:00:00Z' WHERE id=$1",
        [first[0].id],
      );
      await updateKitchenReservation("test-kitchen", "kitchen-actor", {
        orderId: first[0].id,
        action: "cancel",
      });
      assert.equal(
        (await getOrders(consumers[0].id)).find(
          (order) => order.id === first[0].id,
        ).fulfillmentStatus,
        "no_show",
      );
      await updateKitchenReservation("test-kitchen", "kitchen-actor", {
        orderId: first[0].id,
        action: "reset",
      });
      assert.equal(
        (await getOrders(consumers[0].id)).find(
          (order) => order.id === first[0].id,
        ).fulfillmentStatus,
        "pending",
      );
      await db.query(
        "UPDATE offers SET offer_date='2020-01-01',capacity=3 WHERE id=$1",
        [offerId],
      );
      const extraordinary = await addKitchenReservation(
        "test-kitchen",
        "kitchen-actor",
        { offerId, studentId: consumers[1].id, quantity: 1 },
      );
      const extraordinaryOrder = (await getOrders(consumers[1].id)).find(
        (order) => order.id === extraordinary.orderId,
      );
      assert.ok(
        new Date(extraordinaryOrder.createdAt).getTime() >
          new Date("2020-01-01T13:10:00-05:00").getTime(),
      );
      assert.equal(
        (
          await db.query(
            "SELECT action FROM kitchen_reservation_events WHERE order_id=$1",
            [extraordinary.orderId],
          )
        ).rows[0].action,
        "manual_add",
      );
      await assert.rejects(
        updateKitchenReservation("test-kitchen", "kitchen-actor", {
          orderId: extraordinary.orderId,
          action: "cancel",
        }),
        /extraordinaria posterior al recojo/,
      );
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
    console.log(
      "libSQL: migración, catálogo, reserva, idempotencia, cupo, estadísticas, imagen y reseña correctos.",
    );
  } finally {
    await closeDb();
  }
}
