import { db, esAdmin, json, noAutorizado } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await esAdmin())) return noAutorizado();
  const sb = db();
  const { data, error } = await sb
    .from("posts_descargas")
    .select("id, created_at, plantilla, formato, revendedor_id, producto_id")
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) return json({ error: error.message }, 500);
  return json(data);
}
