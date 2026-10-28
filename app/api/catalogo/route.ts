import { db, json } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const sb = db();
  const [marcas, productos] = await Promise.all([
    sb.from("posts_marcas").select("*").eq("activo", true).order("orden").order("nombre"),
    sb.from("posts_productos").select("*").eq("activo", true).order("orden").order("nombre"),
  ]);
  if (marcas.error || productos.error) return json({ error: "No se pudo cargar el catálogo" }, 500);
  return json({ marcas: marcas.data, productos: productos.data });
}
