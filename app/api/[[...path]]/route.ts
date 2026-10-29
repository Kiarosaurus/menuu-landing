import { randomBytes, randomUUID } from "node:crypto";
import { careers } from "../../../server/careers.mjs";
import {
  createBooking,
  findUserByEmail,
  getCatalog,
  getOrders,
  insertSession,
  insertUser,
  removeSession,
  submitReview,
  updateConsumerProfile,
  userFromSession,
} from "../../../server/repository.mjs";
import {
  kitchenData,
  kitchenImage,
  saveDish,
  saveKitchenImage,
  saveOffer,
  updateKitchen,
} from "../../../server/kitchen.mjs";
import { hashPassword, publicUser, verifyPassword } from "../../../server/store.mjs";
import { migrate } from "../../../scripts/migrate.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let migration: Promise<unknown> | undefined;
const ensureDatabase = () => (migration ??= migrate());

function token(request: Request) {
  return request.headers.get("cookie")?.match(/(?:^|;\s*)menuu_session=([^;]*)/)?.[1];
}

function response(value: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

function error(message: string, status = 400) {
  return response({ error: message }, status);
}

function cookie(value: string, maxAge: number) {
  return `menuu_session=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

function validEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@utec\.edu\.pe$/i.test(value.trim());
}

function validBirthDate(value: unknown) {
  if (value === null) return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value &&
    value >= "1900-01-01" &&
    value <= new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
}

async function body(request: Request) {
  try {
    return await request.json();
  } catch {
    throw Object.assign(new Error("Datos inválidos."), { status: 400 });
  }
}

export async function GET(request: Request) {
  await ensureDatabase();
  const url = new URL(request.url);
  const image = /^\/api\/kitchen\/image\/([a-f0-9-]{36})$/.exec(url.pathname);
  if (image) {
    const result = await kitchenImage(image[1]);
    return result
      ? new Response(result.content, {
          headers: { "Content-Type": result.mime, "Cache-Control": "public, max-age=31536000, immutable" },
        })
      : error("Imagen no encontrada.", 404);
  }
  if (url.pathname === "/api/kitchen/data") {
    const user = await userFromSession(token(request));
    if (!user || user.role !== "kitchen" || !user.kitchenId) return error("Inicia sesión como cocina.", 401);
    return response(await kitchenData(user.kitchenId));
  }
  if (url.pathname !== "/api/bootstrap") return error("Ruta no encontrada.", 404);
  const user = await userFromSession(token(request));
  const [catalog, orders] = await Promise.all([
    getCatalog(),
    user?.role === "consumer" ? getOrders(user.id) : [],
  ]);
  return response({ user: publicUser(user), careers, catalog, orders });
}

export async function POST(request: Request) {
  await ensureDatabase();
  const url = new URL(request.url);
  const data = await body(request);
  const session = token(request);
  try {
    if (url.pathname === "/api/auth/register") {
      const name = typeof data.name === "string" ? data.name.trim() : "";
      const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
      const password = typeof data.password === "string" ? data.password : "";
      const studentCode = typeof data.studentCode === "string" ? data.studentCode.trim() : "";
      const career = typeof data.career === "string" ? data.career.trim() : "";
      const birthDate = data.birthDate == null || data.birthDate === "" ? null : data.birthDate;
      if (name.length < 2 || name.length > 80) return error("Escribe tu nombre (2 a 80 caracteres).");
      if (!validEmail(email)) return error("Usa tu correo institucional @utec.edu.pe.");
      if (!/^[0-9]{9}$/.test(studentCode)) return error("El código de estudiante debe tener 9 dígitos.");
      if (!careers.includes(career) || !validBirthDate(birthDate)) return error("Revisa tu carrera y fecha de nacimiento.");
      if (password.length < 5 || password.length > 128) return error("La contraseña debe tener entre 5 y 128 caracteres.");
      if (await findUserByEmail(email)) return error("Ese correo ya tiene una cuenta.", 409);
      const user = { id: randomUUID(), name, email, role: "consumer", studentCode, career, birthDate, passwordHash: hashPassword(password) };
      await insertUser(user);
      const sessionToken = randomBytes(32).toString("hex");
      await insertSession(sessionToken, user.id);
      return response({ user: publicUser(user) }, 201, { "Set-Cookie": cookie(sessionToken, 7 * 86400) });
    }
    if (url.pathname === "/api/auth/login") {
      const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
      const user = await findUserByEmail(email);
      const role = data.role === "kitchen" ? "kitchen" : "consumer";
      if (!user || !verifyPassword(typeof data.password === "string" ? data.password : "", user.passwordHash))
        return error("Correo o contraseña incorrectos.", 401);
      if (user.role !== role) return error("Esta cuenta no tiene acceso para este tipo de usuario.", 403);
      const sessionToken = randomBytes(32).toString("hex");
      await insertSession(sessionToken, user.id);
      return response({ user: publicUser(user) }, 200, { "Set-Cookie": cookie(sessionToken, 7 * 86400) });
    }
    if (url.pathname === "/api/auth/logout") {
      await removeSession(session);
      return response({ ok: true }, 200, { "Set-Cookie": cookie("", 0) });
    }
    const user = await userFromSession(session);
    if (url.pathname === "/api/account/profile") {
      if (!user || user.role !== "consumer") return error("Inicia sesión con tu cuenta de estudiante.", 401);
      const name = typeof data.name === "string" ? data.name.trim() : "";
      const studentCode = typeof data.studentCode === "string" ? data.studentCode.trim() : "";
      const career = typeof data.career === "string" ? data.career.trim() : "";
      const birthDate = data.birthDate == null || data.birthDate === "" ? null : data.birthDate;
      if (name.length < 2 || name.length > 80 || !/^[0-9]{9}$/.test(studentCode) || !careers.includes(career) || !validBirthDate(birthDate))
        return error("Revisa los datos de tu perfil.");
      const updated = await updateConsumerProfile(user.id, { name, studentCode, career, birthDate });
      return updated ? response({ user: publicUser(await userFromSession(session)) }) : error("Cuenta no encontrada.", 404);
    }
    if (url.pathname === "/api/bookings") {
      if (!user || user.role !== "consumer") return error("Inicia sesión con tu cuenta de estudiante.", 401);
      return response({ orders: await createBooking(user.id, data.items, data.requestKey ?? null) }, 201);
    }
    const review = /^\/api\/orders\/([a-zA-Z0-9-]+)\/review$/.exec(url.pathname);
    if (review) {
      if (!user || user.role !== "consumer") return error("Inicia sesión con tu cuenta de estudiante.", 401);
      return response(await submitReview(user.id, review[1], data), 201);
    }
    if (url.pathname.startsWith("/api/kitchen/")) {
      if (!user || user.role !== "kitchen" || !user.kitchenId) return error("Inicia sesión como cocina.", 401);
      if (url.pathname === "/api/kitchen/photo") {
        const mime = (request.headers.get("content-type") || "").split(";")[0];
        const bytes = Buffer.from(await request.arrayBuffer());
        if (bytes.length > 2_000_000) return error("La imagen supera 2 MB.", 413);
        return response({ url: await saveKitchenImage(user.kitchenId, bytes, mime, url.searchParams.get("scope") !== "dish") });
      }
      if (url.pathname === "/api/kitchen/profile") { await updateKitchen(user.kitchenId, data); return response({ ok: true }); }
      if (url.pathname === "/api/kitchen/dishes") return response({ id: await saveDish(user.kitchenId, data) });
      if (url.pathname === "/api/kitchen/offers") return response({ id: await saveOffer(user.kitchenId, data) });
    }
    return error("Ruta no encontrada.", 404);
  } catch (cause) {
    const caught = cause as { status?: number; message?: string };
    return error(caught.status ? caught.message || "Solicitud inválida." : "No pudimos completar la solicitud.", caught.status || 500);
  }
}
