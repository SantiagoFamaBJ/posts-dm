import { bool, crud, num, solo, txt } from "@/lib/crud";
import { db, esAdmin, json, noAutorizado } from "@/lib/server";

export const dynamic = "force-dynamic";

const r = crud("posts_productos", (b, creando) => {
  const nombre = txt(b.nombre, 160);
  if (creando && !nombre) return "El nombre es obligatorio";
  const beneficios = Array.isArray(b.beneficios)
    ? b.beneficios.map((x) => String(x).trim().slice(0, 120)).filter(Boolean).slice(0, 6)
    : [];
  return solo(
    b,
    {
      nombre,
      sku: txt(b.sku, 60),
      marca_id: txt(b.marca_id, 60),
      imagen_url: txt(b.imagen_url, 500),
      imagen_png: txt(b.imagen_png, 500),
      descripcion: txt(b.descripcion, 1000),
      beneficios,
      precio: num(b.precio),
      precio_anterior: num(b.precio_anterior),
      categoria: txt(b.categoria, 80),
      url_web: txt(b.url_web, 500),
      activo: bool(b.activo),
      orden: num(b.orden) ?? 0,
    },
    creando,
  );
});

export const { GET, POST, PUT, DELETE } = r;

// Mostrar / ocultar / asignar marca a varios productos juntos
export async function PATCH(req: Request) {
  if (!(await esAdmin())) return noAutorizado();
  const b = await req.json().catch(() => ({}));
  const ids = Array.isArray(b.ids) ? b.ids.filter((x: unknown) => typeof x === "string") : [];
  if (!ids.length) return json({ error: "No hay productos" }, 400);
  const upd: Record<string, unknown> = {};
  if (typeof b.activo === "boolean") upd.activo = b.activo;
  if ("marca_id" in b) upd.marca_id = typeof b.marca_id === "string" && b.marca_id ? b.marca_id : null;
  if (!Object.keys(upd).length) return json({ error: "Nada para cambiar" }, 400);
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await db().from("posts_productos").update(upd).in("id", ids.slice(i, i + 200));
    if (error) return json({ error: error.message }, 400);
  }
  return json({ ok: true, n: ids.length });
}
