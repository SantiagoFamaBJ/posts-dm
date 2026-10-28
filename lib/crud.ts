import "server-only";
import { db, esAdmin, json, noAutorizado } from "./server";

type Limpiar = (body: Record<string, unknown>, creando: boolean) => Record<string, unknown> | string;

// Rutas GET/POST/PUT/DELETE de admin para una tabla
export function crud(tabla: string, limpiar: Limpiar, orden: string[] = ["orden", "nombre"]) {
  return {
    async GET() {
      if (!(await esAdmin())) return noAutorizado();
      let q = db().from(tabla).select("*");
      for (const o of orden) q = q.order(o);
      const { data, error } = await q;
      if (error) return json({ error: error.message }, 500);
      return json(data);
    },
    async POST(req: Request) {
      if (!(await esAdmin())) return noAutorizado();
      const v = limpiar(await req.json().catch(() => ({})), true);
      if (typeof v === "string") return json({ error: v }, 400);
      const { data, error } = await db().from(tabla).insert(v).select().single();
      if (error) return json({ error: error.message }, 400);
      return json(data);
    },
    async PUT(req: Request) {
      if (!(await esAdmin())) return noAutorizado();
      const body = await req.json().catch(() => ({}));
      if (!body.id) return json({ error: "Falta id" }, 400);
      const v = limpiar(body, false);
      if (typeof v === "string") return json({ error: v }, 400);
      const { data, error } = await db().from(tabla).update(v).eq("id", body.id).select().single();
      if (error) return json({ error: error.message }, 400);
      return json(data);
    },
    async DELETE(req: Request) {
      if (!(await esAdmin())) return noAutorizado();
      const id = new URL(req.url).searchParams.get("id");
      if (!id) return json({ error: "Falta id" }, 400);
      const { error } = await db().from(tabla).delete().eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    },
  };
}

export const txt = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) || null : null);
export const num = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return isNaN(v) ? null : v;
  let s = String(v).replace(/\$/g, "").replace(/\s/g, "");
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(",", ".");
  const n = Number(s);
  return isNaN(n) ? null : n;
};
export const bool = (v: unknown, def = true) => (typeof v === "boolean" ? v : def);
export const color = (v: unknown) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : null);

export function solo(body: Record<string, unknown>, out: Record<string, unknown>, creando: boolean) {
  // en PUT solo actualiza los campos enviados
  if (creando) return out;
  const r: Record<string, unknown> = {};
  for (const k of Object.keys(out)) if (k in body) r[k] = out[k];
  return r;
}
