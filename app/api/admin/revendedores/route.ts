import { bool, color, crud, solo, txt } from "@/lib/crud";
import { db, esAdmin, json, noAutorizado, slugify } from "@/lib/server";

export const dynamic = "force-dynamic";

const limpiar = (b: Record<string, unknown>, creando: boolean) => {
  const nombre = txt(b.nombre, 120);
  if (creando && !nombre) return "El nombre es obligatorio";
  return solo(
    b,
    {
      nombre,
      logo_url: txt(b.logo_url, 500),
      whatsapp: txt(b.whatsapp, 40),
      instagram: txt(b.instagram, 60),
      direccion: txt(b.direccion, 160),
      ciudad: txt(b.ciudad, 80),
      color: color(b.color),
      activo: bool(b.activo),
    },
    creando,
  );
};

const r = crud("posts_revendedores", limpiar, ["nombre"]);

export const { GET, PUT, DELETE } = r;

// Al crear, genera un link único: nombre + código corto
export async function POST(req: Request) {
  if (!(await esAdmin())) return noAutorizado();
  const body = await req.json().catch(() => ({}));
  const v = limpiar(body, true);
  if (typeof v === "string") return json({ error: v }, 400);
  const base = slugify(String(v.nombre)) || "revendedor";
  const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  const { data, error } = await db().from("posts_revendedores").insert({ ...v, slug }).select().single();
  if (error) return json({ error: error.message }, 400);
  return json(data);
}
