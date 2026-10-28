import { db, esAdmin, json, noAutorizado, todasLasFilas } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await esAdmin())) return noAutorizado();
  const desde = new Date(Date.now() - 366 * 864e5).toISOString();
  try {
    const data = await todasLasFilas(() =>
      db()
        .from("posts_descargas")
        .select("id, created_at, plantilla, formato, revendedor_id, producto_id")
        .gte("created_at", desde)
        .order("created_at", { ascending: false })
        .order("id"),
    );
    return json(data);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
}
