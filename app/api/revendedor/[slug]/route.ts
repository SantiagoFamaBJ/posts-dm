import { db, json } from "@/lib/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { slug } = await params;
  const { data } = await db().from("posts_revendedores").select("*").eq("slug", slug).eq("activo", true).maybeSingle();
  if (!data) return json({ error: "No encontrado" }, 404);
  return json(data);
}

const CAMPOS = ["nombre", "logo_url", "whatsapp", "instagram", "direccion", "ciudad", "color"] as const;

export async function PUT(req: Request, { params }: Ctx) {
  const { slug } = await params;
  const body = await req.json().catch(() => ({}));
  const upd: Record<string, string | null> = {};
  for (const k of CAMPOS) {
    if (k in body) {
      const v = typeof body[k] === "string" ? body[k].trim().slice(0, 200) : null;
      upd[k] = v || null;
    }
  }
  if ("nombre" in upd && !upd.nombre) return json({ error: "El nombre es obligatorio" }, 400);
  if (upd.color && !/^#[0-9a-f]{6}$/i.test(upd.color)) upd.color = null;
  if (upd.logo_url && !upd.logo_url.startsWith(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://")) upd.logo_url = null;
  const { data, error } = await db()
    .from("posts_revendedores")
    .update(upd)
    .eq("slug", slug)
    .eq("activo", true)
    .select()
    .maybeSingle();
  if (error || !data) return json({ error: "No se pudo guardar" }, 400);
  return json(data);
}
