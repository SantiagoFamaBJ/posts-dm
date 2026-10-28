import { db, json } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const sb = db();
  const { data: rev } = await sb.from("posts_revendedores").select("id").eq("slug", String(b.slug || "")).maybeSingle();
  if (!rev) return json({ ok: false }, 404);
  await sb.from("posts_descargas").insert({
    revendedor_id: rev.id,
    producto_id: typeof b.producto_id === "string" ? b.producto_id : null,
    plantilla: String(b.plantilla || "").slice(0, 30),
    formato: String(b.formato || "").slice(0, 30),
  });
  return json({ ok: true });
}
