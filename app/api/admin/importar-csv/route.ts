import type { FilaProducto } from "@/lib/csv";
import { db, esAdmin, json, noAutorizado, subirArchivo } from "@/lib/server";
import { bajarImagen, extraerBeneficios, limpiarHtml } from "@/lib/wc";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Recibe un lote de filas del CSV y crea/actualiza productos.
// Busca existentes por ID de WooCommerce y, si no hay, por código.
export async function POST(req: Request) {
  if (!(await esAdmin())) return noAutorizado();
  const { items, ocultos, actualizar, fotos } = (await req.json().catch(() => ({}))) as {
    items?: FilaProducto[];
    ocultos?: boolean;
    actualizar?: boolean;
    fotos?: boolean;
  };
  if (!Array.isArray(items) || !items.length) return json({ error: "No hay productos" }, 400);
  const lote = items.slice(0, 50);
  const sb = db();

  const { data: marcas } = await sb.from("posts_marcas").select("id, nombre");
  const marcaDe = (p: FilaProducto) => {
    const hay = `${p.marca || ""} ${p.nombre} ${p.categoria || ""}`.toLowerCase();
    return (marcas || []).find((m) => hay.includes(m.nombre.toLowerCase()))?.id || null;
  };

  const ids = lote.map((p) => p.wc_id).filter((x): x is number => !!x);
  const skus = lote.map((p) => p.sku).filter((x): x is string => !!x);
  const [porId, porSku] = await Promise.all([
    ids.length ? sb.from("posts_productos").select("id, wc_id, imagen_url, beneficios_ok").in("wc_id", ids) : Promise.resolve({ data: [] }),
    skus.length ? sb.from("posts_productos").select("id, sku, imagen_url, beneficios_ok").in("sku", skus) : Promise.resolve({ data: [] }),
  ]);
  const mapaId = new Map((porId.data || []).map((x: { wc_id: number; id: string; imagen_url: string | null; beneficios_ok: boolean }) => [x.wc_id, x]));
  const mapaSku = new Map((porSku.data || []).map((x: { sku: string; id: string; imagen_url: string | null; beneficios_ok: boolean }) => [x.sku, x]));

  let nuevos = 0;
  let actualizados = 0;
  let salteados = 0;
  let errores = 0;

  await Promise.all(
    lote.map(async (p) => {
      const existe = (p.wc_id && mapaId.get(p.wc_id)) || (p.sku && mapaSku.get(p.sku)) || null;
      if (existe && !actualizar) {
        salteados++;
        return;
      }
      let imagen_url: string | null = existe?.imagen_url || null;
      if (fotos && !imagen_url && p.imagen && /^https?:\/\//.test(p.imagen)) {
        try {
          const img = await bajarImagen(p.imagen);
          imagen_url = await subirArchivo(`productos/${p.wc_id ? "wc-" + p.wc_id : "sku-" + (p.sku || crypto.randomUUID()).replace(/[^\w-]/g, "")}.${img.ext}`, img.buf, img.tipo);
        } catch {
          /* sin foto: se usa el PNG que cargues */
        }
      }
      const marca_id = marcaDe(p);
      const fila: Record<string, unknown> = {
        wc_id: p.wc_id,
        sku: p.sku,
        nombre: limpiarHtml(p.nombre).slice(0, 160),
        // si no detecta marca, no pisa la que asignaste a mano
        ...(marca_id || !existe ? { marca_id } : {}),
        imagen_url,
        descripcion: limpiarHtml(p.html_corto || p.html_largo).slice(0, 1000) || null,
        // los beneficios redactados a mano no se pisan
        ...(existe?.beneficios_ok ? {} : { beneficios: extraerBeneficios(p.html_corto || "", p.html_largo || "") }),
        precio: p.precio,
        precio_anterior: p.precio_anterior,
        categoria: p.categoria,
      };
      const { error } = existe
        ? await sb.from("posts_productos").update(fila).eq("id", existe.id)
        : await sb.from("posts_productos").insert({ ...fila, activo: !ocultos });
      if (error) errores++;
      else if (existe) actualizados++;
      else nuevos++;
    }),
  );

  return json({ nuevos, actualizados, salteados, errores });
}
