import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { leads } from "@/db/schema";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "Solicitud no permitida." }, { status: 403 });
  }

  try {
    const raw = await request.text();
    if (raw.length > 4096) {
      return Response.json(
        { error: "Solicitud demasiado extensa." },
        { status: 413 }
      );
    }

    const body = JSON.parse(raw);
    const credential =
      typeof body.credential === "string" ? body.credential.trim() : "";

    if (!credential) {
      return Response.json(
        { error: "No se proporcionó la credencial de autenticación." },
        { status: 400 }
      );
    }

    // Validar token directamente con el endpoint oficial de Google
    const googleRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
      { cache: "no-store" }
    );

    if (!googleRes.ok) {
      return Response.json(
        { error: "Credencial de Google no válida o expirada." },
        { status: 401 }
      );
    }

    const tokenInfo = (await googleRes.json()) as {
      aud?: string;
      email?: string;
      email_verified?: string | boolean;
      hd?: string;
    };

    const expectedAud =
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;

    if (expectedAud && tokenInfo.aud !== expectedAud) {
      return Response.json(
        { error: "El token de autenticación no pertenece a esta aplicación." },
        { status: 403 }
      );
    }

    const email = (tokenInfo.email || "").trim().toLowerCase();
    const isVerified =
      tokenInfo.email_verified === "true" || tokenInfo.email_verified === true;

    if (!isVerified || !email) {
      return Response.json(
        { error: "El correo de Google no se encuentra verificado." },
        { status: 400 }
      );
    }

    // Validar pertenencia al dominio UTEC
    if (!email.endsWith("@utec.edu.pe")) {
      return Response.json(
        {
          error:
            "Debes iniciar sesión con tu correo institucional @utec.edu.pe.",
        },
        { status: 400 }
      );
    }

    const db = getDb();
    const existing = await db
      .select({ email: leads.email })
      .from(leads)
      .where(eq(leads.email, email))
      .get();

    if (existing) {
      return Response.json(
        { ok: true, alreadyRegistered: true, email },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }

    await db.insert(leads).values({
      email,
      consentVersion: "google-sso-v1",
    });

    return Response.json(
      { ok: true, alreadyRegistered: false, email },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return Response.json(
      {
        error:
          "No pudimos completar tu inscripción con Google. Inténtalo de nuevo.",
      },
      { status: 503 }
    );
  }
}
