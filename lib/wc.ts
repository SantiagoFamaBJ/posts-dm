import "server-only";

// Lee productos públicos de dentalmedrano.com.ar mediante la Store API de WooCommerce
// (la misma que usa la tienda para mostrar productos; no requiere claves).

export type WcProducto = {
  wc_id: number;
  sku: string | null;
  nombre: string;
  url: string;
  imagen: string | null;
  descripcion: string;
  beneficios: string[];
  precio: number | null;
  precio_anterior: number | null;
  categoria: string | null;
  marca: string | null;
};

const BASE = () => (process.env.WC_BASE_URL || "https://dentalmedrano.com.ar").replace(/\/$/, "");

function limpiarHtml(html: string) {
  return (html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|h\d|div)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#8217;|&#039;|&rsquo;/g, "'")
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"')
    .replace(/&#8211;|&ndash;/g, "–")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\n");
}

function extraerBeneficios(htmlCorto: string, htmlLargo: string) {
  const lis = [...(htmlCorto + htmlLargo).matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => limpiarHtml(m[1]));
  let base = lis.length ? lis : limpiarHtml(htmlCorto || htmlLargo).split(/\n|(?<=\.)\s+/);
  base = base
    .map((s) => s.replace(/^[-•·*✓✔]+\s*/, "").replace(/\.$/, "").trim())
    .filter((s) => s.length > 3 && s.length < 140 && !/^(presentaci|contenido|modo de uso|indicaciones)\b/i.test(s));
  return [...new Set(base)].slice(0, 4).map((s) => (s.length > 70 ? s.slice(0, 68).trimEnd() + "…" : s));
}

function precio(v: string | undefined, minor: number) {
  if (!v) return null;
  const n = Number(v);
  if (!n) return null;
  return n / Math.pow(10, minor);
}

// Elige una versión de ~1000px del srcset (ni miniatura ni original gigante)
function elegirImagen(img: { src?: string; srcset?: string } | undefined) {
  if (!img?.src) return null;
  const opciones = (img.srcset || "")
    .split(",")
    .map((s) => s.trim().split(/\s+/))
    .map(([url, w]) => ({ url, w: parseInt(w) || 0 }))
    .filter((o) => o.url && o.w);
  if (!opciones.length) return img.src;
  opciones.sort((a, b) => a.w - b.w);
  return (opciones.find((o) => o.w >= 900) || opciones[opciones.length - 1]).url;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapear(p: any): WcProducto {
  const minor = p.prices?.currency_minor_unit ?? 0;
  const regular = precio(p.prices?.regular_price, minor);
  const actual = precio(p.prices?.price, minor);
  const enOferta = p.on_sale && regular && actual && actual < regular;
  const marcas: string[] = (p.brands || []).map((b: { name: string }) => b.name);
  const atributoMarca = (p.attributes || []).find((a: { name: string }) => /marca|brand/i.test(a.name));
  return {
    wc_id: p.id,
    sku: p.sku ? String(p.sku).trim() : null,
    nombre: limpiarHtml(p.name),
    url: p.permalink,
    imagen: elegirImagen(p.images?.[0]),
    descripcion: limpiarHtml(p.short_description || p.description || "").slice(0, 600),
    beneficios: extraerBeneficios(p.short_description || "", p.description || ""),
    precio: actual,
    precio_anterior: enOferta ? regular : null,
    categoria: p.categories?.[0]?.name ? limpiarHtml(p.categories[0].name) : null,
    marca: marcas[0] || atributoMarca?.terms?.[0]?.name || null,
  };
}

async function pedir(qs: URLSearchParams) {
  const url = `${BASE()}/wp-json/wc/store/v1/products?${qs.toString()}`;
  const r = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (PostsDM)" },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`La tienda respondió ${r.status}`);
  const total = Number(r.headers.get("x-wp-total") || 0);
  const paginas = Number(r.headers.get("x-wp-totalpages") || 1);
  const data = await r.json();
  return { items: (Array.isArray(data) ? data : []).map(mapear), total, paginas };
}

export async function buscarWc(q: string, page = 1) {
  const qs = new URLSearchParams({ per_page: "40", page: String(page) });
  const slug = slugDesdeUrl(q);
  if (slug) qs.set("slug", slug);
  else if (q.trim()) qs.set("search", q.trim());
  return pedir(qs);
}

function slugDesdeUrl(q: string) {
  if (!/^https?:\/\//i.test(q.trim())) return null;
  try {
    const partes = new URL(q.trim()).pathname.split("/").filter(Boolean);
    return partes[partes.length - 1] || null;
  } catch {
    return null;
  }
}

export async function bajarImagen(src: string) {
  const r = await fetch(src, { headers: { "User-Agent": "Mozilla/5.0 (PostsDM)" } });
  if (!r.ok) throw new Error("No se pudo bajar la imagen");
  const tipo = r.headers.get("content-type") || "image/jpeg";
  const buf = await r.arrayBuffer();
  const ext = tipo.includes("png") ? "png" : tipo.includes("webp") ? "webp" : "jpg";
  return { buf, tipo, ext };
}
