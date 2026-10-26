import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { leads } from "@/db/schema";
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return Response.json({ error: "Solicitud no permitida." }, { status: 403 });
  try {
    const raw = await request.text();
    if (raw.length > 2048)
      return Response.json(
        { error: "Solicitud demasiado extensa." },
        { status: 413 }
      );
    const body = JSON.parse(raw);
    if (body.website) return Response.json({ ok: true }, { status: 201 });
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (email.length > 254 || !/^[^\s@]+@utec\.edu\.pe$/.test(email))
      return Response.json(
        { error: "Usa tu correo institucional @utec.edu.pe." },
        { status: 400 }
      );
    if (body.consent !== true)
      return Response.json(
        { error: "Acepta el aviso de privacidad para inscribirte." },
        { status: 400 }
      );

    const db = getDb();
    const existing = await db
      .select({ email: leads.email })
      .from(leads)
      .where(eq(leads.email, email))
      .get();

    if (existing) {
      return Response.json(
        { ok: true, alreadyRegistered: true },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }

    await db.insert(leads).values({ email, consentVersion: "launch-v2" });

    return Response.json(
      { ok: true, alreadyRegistered: false },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return Response.json(
      {
        error:
          "No pudimos guardar tu correo. Inténtalo de nuevo en un momento.",
      },
      { status: 503 }
    );
  }
}

export async function PATCH(request: Request) {
 if (!sameOrigin(request)) return Response.json({ error: "Solicitud no permitida." }, { status: 403 });
 try {
  const body = await readBody(request);
  if (!body) return Response.json({ error: "Solicitud demasiado extensa." }, { status: 413 });
  const email = normalizeEmail(body.email);
  const originalEmail = normalizeEmail(body.originalEmail);
  const token = typeof body.editToken === "string" ? body.editToken : "";
  if (!validEmail(email)) return Response.json({ error: "Usa tu correo institucional @utec.edu.pe." }, { status: 400 });
  if (!validEmail(originalEmail) || !/^[\da-f-]{72}$/.test(token))
   return Response.json({ error: "No se pudo verificar esta corrección." }, { status: 403 });

  const db = getDb();
  const newToken = newEditToken();
  const updated = await db.update(leads).set({
   email,
   editTokenHash: await hashToken(newToken),
   editTokenExpiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  }).where(and(
   eq(leads.email, originalEmail),
   eq(leads.editTokenHash, await hashToken(token)),
   gt(leads.editTokenExpiresAt, new Date().toISOString()),
  )).returning({ email: leads.email });
  if (!updated.length) return Response.json({ error: "La opción de corregir el correo venció. Podrás solicitar el cambio cuando recibas nuestro mensaje." }, { status: 403 });
  return Response.json({ ok: true, editToken: newToken }, { headers: { "Cache-Control": "no-store" } });
 } catch {
  return Response.json({ error: "No pudimos actualizar el correo. Revisa si ya está registrado e inténtalo de nuevo." }, { status: 409 });
 }
}
