import { db, esAdmin, json, noAutorizado, subirArchivo } from "@/lib/server";

export const dynamic = "force-dynamic";

const TIPOS: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

// Sube una imagen al bucket "posts".
// - Admin: carpeta marcas/ o productos/
// - Revendedor: solo su propio logo (requiere slug válido)
export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  const carpeta = String(form.get("carpeta") || "");
  const slug = String(form.get("slug") || "");
  if (!(file instanceof File)) return json({ error: "Falta el archivo" }, 400);
  const ext = TIPOS[file.type];
  if (!ext) return json({ error: "Formato no permitido (usá PNG, JPG o WEBP)" }, 400);
  if (file.size > 4 * 1024 * 1024) return json({ error: "La imagen pesa más de 4 MB" }, 400);

  let path: string;
  if (carpeta === "revendedores") {
    const { data } = await db().from("posts_revendedores").select("id").eq("slug", slug).eq("activo", true).maybeSingle();
    if (!data) return noAutorizado();
    path = `revendedores/${data.id}-${Date.now()}.${ext}`;
  } else if (carpeta === "marcas" || carpeta === "productos" || carpeta === "png") {
    if (!(await esAdmin())) return noAutorizado();
    path = `${carpeta}/${crypto.randomUUID()}.${ext}`;
  } else return json({ error: "Carpeta inválida" }, 400);

  try {
    const url = await subirArchivo(path, await file.arrayBuffer(), file.type);
    return json({ url });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
}
