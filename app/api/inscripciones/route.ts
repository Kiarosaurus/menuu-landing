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
    await getDb()
      .insert(leads)
      .values({ email, consentVersion: "launch-v2" })
      .onConflictDoNothing();
    return Response.json(
      { ok: true },
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
