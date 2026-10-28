import { db, json, todasLasFilas } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const sb = db();
  try {
    const [marcas, productos, etiquetas] = await Promise.all([
      todasLasFilas(() => sb.from("posts_marcas").select("*").eq("activo", true).order("orden").order("nombre").order("id")),
      todasLasFilas(() =>
        sb
          .from("posts_productos")
          .select("id, wc_id, sku, nombre, marca_id, imagen_url, imagen_png, beneficios, precio, precio_anterior, categoria, activo, orden")
          .eq("activo", true)
          .order("orden")
          .order("nombre")
          .order("id"),
      ),
      todasLasFilas(() => sb.from("posts_etiquetas").select("id, texto, orden").order("orden").order("texto").order("id")),
    ]);
    return json({ marcas, productos, etiquetas });
  } catch {
    return json({ error: "No se pudo cargar el catálogo" }, 500);
  }
}
