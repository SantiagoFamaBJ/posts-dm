import { db, esAdmin, json, noAutorizado, subirArchivo } from "@/lib/server";
import { bajarImagen, buscarWc, type WcProducto } from "@/lib/wc";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Busca en dentalmedrano.com.ar
export async function GET(req: Request) {
  if (!(await esAdmin())) return noAutorizado();
  const u = new URL(req.url);
  const q = u.searchParams.get("q") || "";
  const page = Number(u.searchParams.get("page") || 1);
  try {
    const res = await buscarWc(q, page);
    const ids = res.items.map((i) => i.wc_id);
    const { data: ya } = ids.length
      ? await db().from("posts_productos").select("wc_id").in("wc_id", ids)
      : { data: [] as { wc_id: number }[] };
    const set = new Set((ya || []).map((x) => x.wc_id));
    return json({ ...res, items: res.items.map((i) => ({ ...i, importado: set.has(i.wc_id) })) });
  } catch (e) {
    return json({ error: "No se pudo leer la tienda: " + (e as Error).message }, 502);
  }
}

// Importa una lista de productos (los que vienen de la búsqueda)
export async function POST(req: Request) {
  if (!(await esAdmin())) return noAutorizado();
  const { items, marca_id } = (await req.json().catch(() => ({}))) as { items?: WcProducto[]; marca_id?: string };
  if (!Array.isArray(items) || !items.length) return json({ error: "No hay productos" }, 400);
  const sb = db();
  const { data: marcas } = await sb.from("posts_marcas").select("id, nombre");

  const detectarMarca = (p: WcProducto) => {
    if (marca_id) return marca_id;
    const hay = `${p.marca || ""} ${p.nombre} ${p.categoria || ""}`.toLowerCase();
    const m = (marcas || []).find((m) => hay.includes(m.nombre.toLowerCase()));
    return m?.id || null;
  };

  const resultados: { wc_id: number; ok: boolean; error?: string }[] = [];
  for (const p of items.slice(0, 40)) {
    try {
      let imagen_url: string | null = null;
      if (p.imagen && /^https?:\/\//.test(p.imagen)) {
        try {
          const img = await bajarImagen(p.imagen);
          imagen_url = await subirArchivo(`productos/wc-${p.wc_id}.${img.ext}`, img.buf, img.tipo);
        } catch {
          imagen_url = null;
        }
      }
      const fila = {
        wc_id: p.wc_id,
        nombre: String(p.nombre).slice(0, 160),
        marca_id: detectarMarca(p),
        imagen_url,
        descripcion: p.descripcion?.slice(0, 1000) || null,
        beneficios: (p.beneficios || []).slice(0, 4),
        precio: p.precio,
        precio_anterior: p.precio_anterior,
        categoria: p.categoria,
        url_web: p.url,
        activo: true,
      };
      const { error } = await sb.from("posts_productos").upsert(fila, { onConflict: "wc_id" });
      resultados.push({ wc_id: p.wc_id, ok: !error, error: error?.message });
    } catch (e) {
      resultados.push({ wc_id: p.wc_id, ok: false, error: (e as Error).message });
    }
  }
  return json({ resultados });
}
