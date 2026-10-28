import { COOKIE, esAdmin, json, tokenAdmin } from "@/lib/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET() {
  return json({ ok: await esAdmin() });
}

export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({ password: "" }));
  if (String(password || "").trim().toLowerCase() !== (process.env.ADMIN_PASSWORD || "dm2026").toLowerCase())
    return json({ error: "Contraseña incorrecta" }, 401);
  const c = await cookies();
  c.set(COOKIE, tokenAdmin(), { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24 * 60 });
  return json({ ok: true });
}

export async function DELETE() {
  const c = await cookies();
  c.delete(COOKIE);
  return json({ ok: true });
}
