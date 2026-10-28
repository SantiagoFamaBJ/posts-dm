import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { cookies } from "next/headers";

export const BUCKET = "posts";

export function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan variables de entorno de Supabase");
  return createClient(url, key, { auth: { persistSession: false } });
}

export const COOKIE = "posts_admin";

export function tokenAdmin() {
  const pass = process.env.ADMIN_PASSWORD || "dm2026";
  return createHash("sha256").update("posts-dm:" + pass).digest("hex");
}

export async function esAdmin() {
  const c = await cookies();
  return c.get(COOKIE)?.value === tokenAdmin();
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export const noAutorizado = () => json({ error: "No autorizado" }, 401);

export async function subirArchivo(path: string, data: ArrayBuffer | Buffer, contentType: string) {
  const sb = db();
  const { error } = await sb.storage.from(BUCKET).upload(path, data, { contentType, upsert: true, cacheControl: "31536000" });
  if (error) throw new Error(error.message);
  const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
  return pub.publicUrl;
}

export function slugify(t: string) {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
