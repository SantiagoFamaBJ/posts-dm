"use client";

import { FORMATOS, type Marca, type PostConfig, type Producto, type Revendedor } from "./types";

/* ───────────────────────── Imágenes ───────────────────────── */

export type LoadedImage = { img: HTMLImageElement; transparente: boolean };

const cache = new Map<string, Promise<LoadedImage | null>>();

export function loadImage(url: string | null | undefined): Promise<LoadedImage | null> {
  if (!url) return Promise.resolve(null);
  const hit = cache.get(url);
  if (hit) return hit;
  const p = new Promise<LoadedImage | null>((resolve) => {
    const img = new Image();
    if (!url.startsWith("blob:") && !url.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => resolve({ img, transparente: tieneTransparencia(img) });
    img.onerror = () => resolve(null);
    img.src = url;
  });
  cache.set(url, p);
  return p;
}

function tieneTransparencia(img: HTMLImageElement): boolean {
  try {
    const c = document.createElement("canvas");
    const s = 48;
    c.width = s;
    c.height = s;
    const x = c.getContext("2d")!;
    x.drawImage(img, 0, 0, s, s);
    const d = x.getImageData(0, 0, s, s).data;
    const puntos = [
      [0, 0], [s - 1, 0], [0, s - 1], [s - 1, s - 1],
      [s / 2, 0], [0, s / 2], [s - 1, s / 2], [s / 2, s - 1],
    ];
    return puntos.some(([px, py]) => d[(Math.floor(py) * s + Math.floor(px)) * 4 + 3] < 245);
  } catch {
    return false;
  }
}

/* ───────────────────────── Colores ───────────────────────── */

function hexToRgb(hex: string) {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h || "f15922", 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
export function rgba(hex: string, a: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
function luminancia(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export function textoSobre(hex: string) {
  return luminancia(hex) > 0.45 ? "#16181d" : "#ffffff";
}
function oscurecer(hex: string, k: number) {
  const { r, g, b } = hexToRgb(hex);
  const m = (v: number) => Math.max(0, Math.round(v * (1 - k)));
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}

/* ───────────────────────── Texto ───────────────────────── */

const F_TITULO = "Montserrat";
const F_CUERPO = "Barlow";

export async function cargarFuentes() {
  if (typeof document === "undefined" || !document.fonts) return;
  await Promise.all([
    document.fonts.load(`800 60px ${F_TITULO}`),
    document.fonts.load(`700 60px ${F_TITULO}`),
    document.fonts.load(`500 40px ${F_CUERPO}`),
    document.fonts.load(`600 40px ${F_CUERPO}`),
  ]).catch(() => {});
}

function font(peso: number, size: number, fam: string) {
  return `${peso} ${size}px ${fam}, Arial, sans-serif`;
}

function wrap(ctx: CanvasRenderingContext2D, texto: string, maxW: number): string[] {
  const palabras = texto.replace(/\s+/g, " ").trim().split(" ");
  const lineas: string[] = [];
  let actual = "";
  for (const p of palabras) {
    const prueba = actual ? actual + " " + p : p;
    if (ctx.measureText(prueba).width <= maxW || !actual) actual = prueba;
    else {
      lineas.push(actual);
      actual = p;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

function recortar(ctx: CanvasRenderingContext2D, lineas: string[], maxLineas: number, maxW: number) {
  if (lineas.length <= maxLineas) return lineas;
  const out = lineas.slice(0, maxLineas);
  let ult = out[maxLineas - 1];
  while (ult.length > 1 && ctx.measureText(ult + "…").width > maxW) ult = ult.slice(0, -1);
  out[maxLineas - 1] = ult.trimEnd() + "…";
  return out;
}

type Bloque = { size: number; lineas: string[]; lh: number };

function ajustar(
  ctx: CanvasRenderingContext2D,
  texto: string,
  peso: number,
  fam: string,
  max: number,
  min: number,
  maxW: number,
  maxLineas: number,
  lhK = 1.12,
): Bloque {
  for (let s = max; s >= min; s -= 2) {
    ctx.font = font(peso, s, fam);
    const l = wrap(ctx, texto, maxW);
    if (l.length <= maxLineas) return { size: s, lineas: l, lh: s * lhK };
  }
  ctx.font = font(peso, min, fam);
  return { size: min, lineas: recortar(ctx, wrap(ctx, texto, maxW), maxLineas, maxW), lh: min * lhK };
}

export function formatearPrecio(v: string) {
  const t = (v || "").trim();
  if (!t) return "";
  const limpio = t.replace(/\$/g, "").replace(/\s/g, "");
  if (/^\d+([.,]\d{1,2})?$/.test(limpio) || /^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(limpio)) {
    let n: number;
    if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(limpio)) n = Number(limpio.replace(/\./g, "").replace(",", "."));
    else n = Number(limpio.replace(",", "."));
    if (!isNaN(n)) {
      const dec = n % 1 !== 0;
      return "$" + n.toLocaleString("es-AR", { minimumFractionDigits: dec ? 2 : 0, maximumFractionDigits: 2 });
    }
  }
  return t;
}

/* ───────────────────────── Formas ───────────────────────── */

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function contain(iw: number, ih: number, x: number, y: number, w: number, h: number) {
  const k = Math.min(w / iw, h / ih);
  const dw = iw * k;
  const dh = ih * k;
  return { x: x + (w - dw) / 2, y: y + (h - dh) / 2, w: dw, h: dh };
}

// Logo oficial de WhatsApp (trazado de 24x24)
const WA_PATH =
  "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z";
let waPath: Path2D | null = null;

function iconoWhatsapp(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  if (!waPath) waPath = new Path2D(WA_PATH);
  const k = (r * 2) / 24;
  ctx.save();
  ctx.translate(cx - r, cy - r);
  ctx.scale(k, k);
  ctx.fillStyle = color;
  ctx.fill(waPath);
  ctx.restore();
}

function iconoInstagram(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = r * 0.18;
  rr(ctx, cx - r * 0.85, cy - r * 0.85, r * 1.7, r * 1.7, r * 0.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.38, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx + r * 0.45, cy - r * 0.45, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function iconoPin(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.25, r * 0.62, Math.PI * 0.85, Math.PI * 2.15);
  ctx.lineTo(cx, cy + r * 0.95);
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.28, r * 0.24, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function check(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, bg: string, fg: string) {
  ctx.save();
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = fg;
  ctx.lineWidth = r * 0.28;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.45, cy + r * 0.02);
  ctx.lineTo(cx - r * 0.12, cy + r * 0.35);
  ctx.lineTo(cx + r * 0.48, cy - r * 0.32);
  ctx.stroke();
  ctx.restore();
}

/* ───────────────────────── Tema ───────────────────────── */

type Tema = {
  bg: (ctx: CanvasRenderingContext2D, W: number, H: number) => void;
  texto: string;
  suave: string;
  acento: string; // color de precios / checks
  sobreAcento: string;
  circulo: string | null;
  panelBlanco: boolean; // producto sobre tarjeta blanca (para fondos oscuros/color)
  footerBg: string;
  footerTexto: string;
  footerSlim: boolean;
  centrado: boolean;
  badgeBg: string;
  badgeTexto: string;
  ctaBg: string;
  ctaTexto: string;
  claro: boolean;
};

function tema(cfg: PostConfig): Tema {
  const a = cfg.colorAcento || "#f15922";
  const sobreA = textoSobre(a);
  if (cfg.plantilla === "promo") {
    const t = textoSobre(a);
    return {
      bg: (ctx, W, H) => {
        const g = ctx.createLinearGradient(0, 0, W * 0.4, H);
        g.addColorStop(0, a);
        g.addColorStop(1, oscurecer(a, 0.28));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = rgba(t === "#ffffff" ? "#ffffff" : "#000000", 0.07);
        ctx.beginPath();
        ctx.arc(W * 1.02, H * 0.08, W * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-W * 0.12, H * 0.92, W * 0.38, 0, Math.PI * 2);
        ctx.fill();
      },
      texto: t,
      suave: t === "#ffffff" ? "rgba(255,255,255,0.82)" : "rgba(22,24,29,0.75)",
      acento: t,
      sobreAcento: a,
      circulo: "#ffffff",
      panelBlanco: false,
      footerBg: "#ffffff",
      footerTexto: "#16181d",
      footerSlim: false,
      centrado: true,
      badgeBg: t === "#ffffff" ? "#ffffff" : "#16181d",
      badgeTexto: t === "#ffffff" ? a : "#ffffff",
      ctaBg: t === "#ffffff" ? "#ffffff" : "#16181d",
      ctaTexto: t === "#ffffff" ? oscurecer(a, 0.1) : "#ffffff",
      claro: false,
    };
  }
  const oscuro = cfg.fondo === "oscuro";
  if (cfg.plantilla === "minimal") {
    return {
      bg: (ctx, W, H) => {
        ctx.fillStyle = oscuro ? "#111214" : "#f4f2ee";
        ctx.fillRect(0, 0, W, H);
      },
      texto: oscuro ? "#ffffff" : "#18191b",
      suave: oscuro ? "#a3a7ad" : "#6b6b6b",
      acento: a,
      sobreAcento: sobreA,
      circulo: null,
      panelBlanco: oscuro,
      footerBg: "transparent",
      footerTexto: oscuro ? "#ffffff" : "#18191b",
      footerSlim: true,
      centrado: true,
      badgeBg: a,
      badgeTexto: sobreA,
      ctaBg: a,
      ctaTexto: sobreA,
      claro: !oscuro,
    };
  }
  // destacado
  return {
    bg: (ctx, W, H) => {
      if (oscuro) {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#1a1c21");
        g.addColorStop(1, "#0e0f12");
        ctx.fillStyle = g;
      } else {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#ffffff");
        g.addColorStop(1, "#f1f2f4");
        ctx.fillStyle = g;
      }
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = a;
      ctx.fillRect(0, 0, W, 14);
    },
    texto: oscuro ? "#ffffff" : "#16181d",
    suave: oscuro ? "#aab0b8" : "#5c6066",
    acento: a,
    sobreAcento: sobreA,
    circulo: rgba(a, oscuro ? 0.22 : 0.13),
    panelBlanco: oscuro,
    footerBg: oscuro ? a : "#16181d",
    footerTexto: oscuro ? sobreA : "#ffffff",
    footerSlim: false,
    centrado: false,
    badgeBg: a,
    badgeTexto: sobreA,
    ctaBg: a,
    ctaTexto: sobreA,
    claro: !oscuro,
  };
}

/* ───────────────────────── Render principal ───────────────────────── */

export type RenderInput = {
  cfg: PostConfig;
  producto: Producto | null;
  marca: Marca | null;
  revendedor: Revendedor;
  imgProducto: LoadedImage | null;
  imgMarca: LoadedImage | null;
  imgRevendedor: LoadedImage | null;
};

export type Rect = { x: number; y: number; w: number; h: number };
export type Elemento = "producto" | "logo" | "badge";
export type Zonas = Partial<Record<Elemento, Rect>>;
let zonas: Zonas = {};
const off = (p?: { x: number; y: number }) => ({ x: p?.x || 0, y: p?.y || 0 });

export function renderPost(canvas: HTMLCanvasElement, input: RenderInput): Zonas {
  zonas = {};
  const { cfg } = input;
  const { w: W, h: H } = FORMATOS[cfg.formato];
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.textBaseline = "alphabetic";
  const t = tema(cfg);

  const story = cfg.formato === "story";
  const pad = 72;
  const safeTop = story ? 190 : 0;
  const safeBottom = story ? 210 : 0;

  t.bg(ctx, W, H);

  /* Header */
  const headerY = safeTop + pad - (cfg.plantilla === "destacado" ? 4 : 10);
  const headerH = 96;

  /* Footer */
  const footerH = t.footerSlim ? 120 : cfg.formato === "cuadrado" ? 136 : 156;
  const footerY = H - safeBottom - footerH;
  if (story && !t.footerSlim && t.footerBg !== "transparent") {
    ctx.fillStyle = t.footerBg;
    ctx.fillRect(0, footerY, W, H - footerY);
  }
  dibujarFooter(ctx, input, t, footerY, W, footerH, pad);

  /* Cuerpo */
  const top = headerY + headerH + 24;
  const bottom = footerY - (t.footerSlim ? 20 : 44);
  const split = cfg.formato === "cuadrado" && cfg.plantilla !== "minimal";
  if (split) cuerpoSplit(ctx, input, t, pad, top, W - pad, bottom);
  else cuerpoStack(ctx, input, t, pad, top, W - pad, bottom);

  // logo y etiqueta al final para que queden arriba del producto si los mueven
  dibujarHeader(ctx, input, t, pad, headerY, W - pad * 2, headerH);
  return zonas;
}

function dibujarHeader(
  ctx: CanvasRenderingContext2D,
  { cfg, marca, imgMarca }: RenderInput,
  t: Tema,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const centrarLogo = t.centrado && !cfg.mostrarBadge;
  const pill = !!cfg.fondoLogo;
  if (cfg.mostrarLogoMarca && (imgMarca || marca)) {
    const o = off(cfg.posLogo);
    ctx.save();
    ctx.translate(o.x, o.y);
    const maxW = 300;
    const maxH = h - (pill ? 28 : 8);
    let lw = 0;
    let lh = 0;
    if (imgMarca) {
      const k = Math.min(maxW / imgMarca.img.width, maxH / imgMarca.img.height);
      lw = imgMarca.img.width * k;
      lh = imgMarca.img.height * k;
    } else {
      ctx.font = font(800, 40, F_TITULO);
      lw = ctx.measureText(marca!.nombre.toUpperCase()).width;
      lh = 40;
    }
    const px = pill ? 30 : 0;
    const boxW = lw + px * 2;
    const bx = centrarLogo ? x + (w - boxW) / 2 : x;
    zonas.logo = { x: bx + o.x, y: y + o.y, w: boxW, h };
    if (pill) {
      ctx.fillStyle = "#ffffff";
      rr(ctx, bx, y, boxW, h, h / 2);
      ctx.fill();
    }
    const ly = y + (h - lh) / 2;
    if (imgMarca) {
      ctx.save();
      if (!imgMarca.transparente && (t.claro || pill)) ctx.globalCompositeOperation = "multiply";
      ctx.drawImage(imgMarca.img, bx + px, ly, lw, lh);
      ctx.restore();
    } else {
      ctx.fillStyle = pill ? marca!.color || "#16181d" : t.texto;
      ctx.font = font(800, 40, F_TITULO);
      ctx.fillText(marca!.nombre.toUpperCase(), bx + px, y + h / 2 + 14);
    }
    ctx.restore();
  }
  if (cfg.mostrarBadge && cfg.badgeTexto.trim()) {
    const txt = cfg.badgeTexto.trim().toUpperCase();
    let s = 38;
    ctx.font = font(800, s, F_TITULO);
    while (ctx.measureText(txt).width > 380 && s > 24) {
      s -= 2;
      ctx.font = font(800, s, F_TITULO);
    }
    const tw = ctx.measureText(txt).width;
    const bw = tw + 64;
    const bh = 78;
    const o = off(cfg.posBadge);
    const bx = x + w - bw + o.x;
    const by = y + (h - bh) / 2 + o.y;
    zonas.badge = { x: bx, y: by, w: bw, h: bh };
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.18)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = t.badgeBg;
    rr(ctx, bx, by, bw, bh, bh / 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = t.badgeTexto;
    ctx.fillText(txt, bx + 32, by + bh / 2 + s * 0.36);
  }
}

function dibujarFooter(
  ctx: CanvasRenderingContext2D,
  { cfg, revendedor, imgRevendedor }: RenderInput,
  t: Tema,
  y: number,
  W: number,
  h: number,
  pad: number,
) {
  const contactos: { tipo: "wa" | "ig" | "pin"; txt: string }[] = [];
  if (cfg.mostrarWhatsapp && revendedor.whatsapp) contactos.push({ tipo: "wa", txt: revendedor.whatsapp });
  if (cfg.mostrarInstagram && revendedor.instagram)
    contactos.push({ tipo: "ig", txt: "@" + revendedor.instagram.replace(/^@/, "") });
  if (cfg.mostrarDireccion && (revendedor.direccion || revendedor.ciudad))
    contactos.push({
      tipo: "pin",
      txt: [revendedor.direccion, revendedor.ciudad].filter(Boolean).join(", "),
    });

  const icono = (tipo: string, cx: number, cy: number, r: number, c: string) =>
    tipo === "wa" ? iconoWhatsapp(ctx, cx, cy, r, c) : tipo === "ig" ? iconoInstagram(ctx, cx, cy, r, c) : iconoPin(ctx, cx, cy, r, c);

  if (t.footerSlim) {
    // línea fina + logo y contactos centrados en una fila
    ctx.fillStyle = rgba(t.footerTexto === "#ffffff" ? "#ffffff" : "#000000", 0.12);
    ctx.fillRect(pad, y, W - pad * 2, 2);
    const cy = y + h / 2 + 6;
    const piezas: { w: number; draw: (x: number) => void }[] = [];
    const logoH = 64;
    if (imgRevendedor) {
      const k = Math.min(240 / imgRevendedor.img.width, logoH / imgRevendedor.img.height);
      const lw = imgRevendedor.img.width * k;
      const lh = imgRevendedor.img.height * k;
      const pill = !imgRevendedor.transparente && !t.claro;
      const bw = lw + (pill ? 28 : 0);
      piezas.push({
        w: bw,
        draw: (x) => {
          if (pill) {
            ctx.fillStyle = "#fff";
            rr(ctx, x, cy - lh / 2 - 10, bw, lh + 20, 14);
            ctx.fill();
          }
          ctx.save();
          if (!imgRevendedor.transparente && t.claro) ctx.globalCompositeOperation = "multiply";
          ctx.drawImage(imgRevendedor.img, x + (pill ? 14 : 0), cy - lh / 2, lw, lh);
          ctx.restore();
        },
      });
    } else {
      ctx.font = font(800, 34, F_TITULO);
      const nw = ctx.measureText(revendedor.nombre).width;
      piezas.push({
        w: nw,
        draw: (x) => {
          ctx.font = font(800, 34, F_TITULO);
          ctx.fillStyle = t.footerTexto;
          ctx.fillText(revendedor.nombre, x, cy + 12);
        },
      });
    }
    let size = 30;
    const medir = () => {
      ctx.font = font(600, size, F_CUERPO);
      return contactos.map((c) => ctx.measureText(c.txt).width + size * 1.4);
    };
    let anchos = medir();
    const gap = 36;
    const total = () => piezas[0].w + anchos.reduce((s, v) => s + v + gap, 0);
    while (total() > W - pad * 2 && size > 20) {
      size -= 2;
      anchos = medir();
    }
    let x = (W - total()) / 2;
    piezas[0].draw(x);
    x += piezas[0].w + gap;
    contactos.forEach((c, i) => {
      icono(c.tipo, x + size * 0.5, cy, size * 0.5, t.acento);
      ctx.font = font(600, size, F_CUERPO);
      ctx.fillStyle = t.footerTexto;
      ctx.fillText(c.txt, x + size * 1.4, cy + size * 0.35);
      x += anchos[i] + gap;
    });
    return;
  }

  ctx.fillStyle = t.footerBg;
  ctx.fillRect(0, y, W, h);

  // Logo / nombre a la izquierda
  let izqW = 0;
  const logoMaxH = h - 44;
  if (imgRevendedor) {
    const k = Math.min(300 / imgRevendedor.img.width, logoMaxH / imgRevendedor.img.height);
    const lw = imgRevendedor.img.width * k;
    const lh = imgRevendedor.img.height * k;
    const fondoBlanco = t.footerBg !== "#ffffff";
    const px = fondoBlanco ? 22 : 0;
    const boxH = lh + (fondoBlanco ? 24 : 0);
    if (fondoBlanco) {
      ctx.fillStyle = "#ffffff";
      rr(ctx, pad, y + (h - boxH) / 2, lw + px * 2, boxH, 18);
      ctx.fill();
    }
    ctx.save();
    if (!imgRevendedor.transparente) ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(imgRevendedor.img, pad + px, y + (h - lh) / 2, lw, lh);
    ctx.restore();
    izqW = lw + px * 2;
  } else {
    const b = ajustar(ctx, revendedor.nombre, 800, F_TITULO, 40, 26, contactos.length ? 420 : W - pad * 2, 2, 1.1);
    ctx.font = font(800, b.size, F_TITULO);
    ctx.fillStyle = t.footerTexto;
    const total = b.lineas.length * b.lh;
    b.lineas.forEach((l, i) => ctx.fillText(l, pad, y + (h - total) / 2 + b.lh * (i + 0.78)));
    izqW = Math.max(...b.lineas.map((l) => ctx.measureText(l).width));
  }

  if (!contactos.length) return;
  const disponible = W - pad * 2 - izqW - 40;
  let size = contactos.length >= 3 ? 27 : 31;
  ctx.font = font(600, size, F_CUERPO);
  const ancho = () => Math.max(...contactos.map((c) => ctx.measureText(c.txt).width)) + size * 1.5;
  while (ancho() > disponible && size > 18) {
    size -= 1;
    ctx.font = font(600, size, F_CUERPO);
  }
  const lh = size * 1.42;
  const totalH = contactos.length * lh;
  const startY = y + (h - totalH) / 2;
  contactos.forEach((c, i) => {
    ctx.font = font(600, size, F_CUERPO);
    let txt = c.txt;
    while (ctx.measureText(txt).width + size * 1.5 > disponible && txt.length > 4) txt = txt.slice(0, -2);
    if (txt !== c.txt) txt = txt.trimEnd() + "…";
    const tw = ctx.measureText(txt).width;
    const rx = W - pad;
    const cy = startY + lh * i + lh / 2;
    ctx.fillStyle = t.footerTexto;
    ctx.textAlign = "right";
    ctx.fillText(txt, rx, cy + size * 0.35);
    ctx.textAlign = "left";
    const iconC = t.footerBg === "#ffffff" ? t.sobreAcento : t.footerTexto;
    icono(c.tipo, rx - tw - size * 0.85, cy, size * 0.48, t.footerBg === "#ffffff" ? iconC : t.footerTexto);
  });
}

/* Producto con círculo / sombra */
function dibujarProducto(
  ctx: CanvasRenderingContext2D,
  { cfg, imgProducto }: RenderInput,
  t: Tema,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  if (h < 60 || w < 60) return;
  const cx0 = x + w / 2;
  const cy0 = y + h / 2;
  const d = Math.min(w, h);
  if (t.circulo) {
    ctx.fillStyle = t.circulo;
    ctx.beginPath();
    ctx.arc(cx0, cy0, d * 0.48, 0, Math.PI * 2);
    ctx.fill();
  }
  const o = off(cfg.posProducto);
  const cx = cx0 + o.x;
  const cy = cy0 + o.y;
  if (!imgProducto) {
    ctx.fillStyle = rgba(t.texto === "#ffffff" ? "#ffffff" : "#000000", 0.25);
    ctx.font = font(600, 30, F_CUERPO);
    ctx.textAlign = "center";
    ctx.fillText("Sin imagen", cx, cy + 10);
    ctx.textAlign = "left";
    zonas.producto = { x: cx - d * 0.4, y: cy - d * 0.4, w: d * 0.8, h: d * 0.8 };
    return;
  }
  const esc = Math.max(0.4, Math.min(1.8, cfg.escalaProducto || 1));
  const base = t.circulo ? 0.8 : 0.94;
  const bw = (t.circulo ? d : w) * base * esc;
  const bh = (t.circulo ? d : h) * base * esc;
  const r = contain(imgProducto.img.width, imgProducto.img.height, cx - bw / 2, cy - bh / 2, bw, bh);
  const ang = ((cfg.rotacion || 0) * Math.PI) / 180;
  // caja que ocupa el producto ya rotado (para poder agarrarlo)
  const cos = Math.abs(Math.cos(ang));
  const sin = Math.abs(Math.sin(ang));
  const zw = r.w * cos + r.h * sin;
  const zh = r.w * sin + r.h * cos;
  zonas.producto = { x: cx - zw / 2, y: cy - zh / 2, w: zw, h: zh };

  const rotar = () => {
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    ctx.translate(-cx, -cy);
  };

  if (!imgProducto.transparente && (t.panelBlanco || !t.claro) && !t.circulo?.startsWith("#ffffff")) {
    // foto con fondo blanco sobre fondo oscuro: tarjeta blanca
    ctx.save();
    rotar();
    if (cfg.sombra !== false) {
      ctx.shadowColor = "rgba(0,0,0,0.35)";
      ctx.shadowBlur = 50;
      ctx.shadowOffsetY = 18;
    }
    ctx.fillStyle = "#ffffff";
    rr(ctx, r.x - 28, r.y - 28, r.w + 56, r.h + 56, 36);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.drawImage(imgProducto.img, r.x, r.y, r.w, r.h);
    ctx.restore();
    return;
  }

  // sombra en el piso (no rota)
  if (cfg.sombra !== false) {
  ctx.save();
  const piso = cy + zh / 2;
  const sg = ctx.createRadialGradient(cx, piso, 0, cx, piso, zw * 0.5);
  sg.addColorStop(0, "rgba(0,0,0,0.22)");
  sg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.ellipse(cx, piso - 6, zw * 0.45, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  }

  ctx.save();
  rotar();
  if (!imgProducto.transparente) ctx.globalCompositeOperation = "multiply";
  else if (cfg.sombra !== false) {
    ctx.shadowColor = "rgba(0,0,0,0.18)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 14;
  }
  ctx.drawImage(imgProducto.img, r.x, r.y, r.w, r.h);
  ctx.restore();
}

/* Medición y dibujo del bloque de texto */
type Medida = {
  titulo: Bloque;
  sub: Bloque | null;
  benef: { lineas: string[]; lh: number; size: number }[];
  precio: string;
  anterior: string;
  leyenda: string;
  precioSize: number;
  cta: string;
  alto: number;
};

function medirTexto(
  ctx: CanvasRenderingContext2D,
  cfg: PostConfig,
  maxW: number,
  escala: number,
  promo: boolean,
): Medida {
  const titulo = ajustar(ctx, cfg.titulo || " ", 800, F_TITULO, Math.round(76 * escala), Math.round(42 * escala), maxW, 3, 1.08);
  let sub: Bloque | null = null;
  if (cfg.subtitulo.trim()) sub = ajustar(ctx, cfg.subtitulo, 500, F_CUERPO, Math.round(36 * escala), Math.round(26 * escala), maxW, 2, 1.2);
  const bs = Math.round(32 * escala);
  const benef = cfg.mostrarBeneficios
    ? cfg.beneficios
        .filter((b) => b.trim())
        .slice(0, 4)
        .map((b) => {
          ctx.font = font(500, bs, F_CUERPO);
          const l = recortar(ctx, wrap(ctx, b, maxW - bs * 1.6), 2, maxW - bs * 1.6);
          return { lineas: l, lh: bs * 1.18, size: bs };
        })
    : [];
  const precio = cfg.mostrarPrecio ? formatearPrecio(cfg.precio) : "";
  const anterior = cfg.mostrarPrecio && cfg.mostrarPrecioAnterior ? formatearPrecio(cfg.precioAnterior) : "";
  const leyenda = cfg.mostrarPrecio ? cfg.leyendaPrecio.trim() : "";
  let precioSize = Math.round((promo ? 124 : 92) * escala);
  if (precio) {
    ctx.font = font(800, precioSize, F_TITULO);
    while (ctx.measureText(precio).width > maxW && precioSize > 40) {
      precioSize -= 4;
      ctx.font = font(800, precioSize, F_TITULO);
    }
  }
  const cta = cfg.mostrarCta ? cfg.ctaTexto.trim() : "";

  let alto = titulo.lineas.length * titulo.lh;
  if (sub) alto += 14 + sub.lineas.length * sub.lh;
  if (benef.length) alto += 34 + benef.reduce((s, b) => s + b.lineas.length * b.lh + 16, -16);
  if (precio || anterior) {
    alto += 34;
    if (anterior) alto += 44 * escala;
    if (precio) alto += precioSize * 0.92;
    if (leyenda) alto += 40 * escala;
  }
  if (cta) alto += 30 + 76 * escala;
  return { titulo, sub, benef, precio, anterior, leyenda, precioSize, cta, alto };
}

function dibujarTexto(
  ctx: CanvasRenderingContext2D,
  m: Medida,
  t: Tema,
  x: number,
  y: number,
  w: number,
  centrado: boolean,
  escala: number,
) {
  const ax = centrado ? x + w / 2 : x;
  ctx.textAlign = centrado ? "center" : "left";
  let cy = y;

  ctx.font = font(800, m.titulo.size, F_TITULO);
  ctx.fillStyle = t.texto;
  m.titulo.lineas.forEach((l) => {
    cy += m.titulo.lh;
    ctx.fillText(l, ax, cy - m.titulo.lh * 0.2);
  });

  if (m.sub) {
    cy += 14;
    ctx.font = font(500, m.sub.size, F_CUERPO);
    ctx.fillStyle = t.suave;
    m.sub.lineas.forEach((l) => {
      cy += m.sub!.lh;
      ctx.fillText(l, ax, cy - m.sub!.lh * 0.22);
    });
  }

  if (m.benef.length) {
    cy += 34;
    m.benef.forEach((b, i) => {
      if (i > 0) cy += 16;
      const s = b.size;
      ctx.font = font(500, s, F_CUERPO);
      if (centrado) {
        b.lineas.forEach((l, j) => {
          const lw = ctx.measureText(l).width;
          const lineY = cy + b.lh * (j + 1);
          if (j === 0) {
            const chkX = x + w / 2 - (lw + s * 1.3) / 2 + s * 0.42;
            check(ctx, chkX, lineY - s * 0.34, s * 0.42, t.acento, t.sobreAcento);
            ctx.fillStyle = t.texto;
            ctx.textAlign = "left";
            ctx.fillText(l, chkX + s * 0.75, lineY - b.lh * 0.12);
            ctx.textAlign = "center";
          } else {
            ctx.fillStyle = t.texto;
            ctx.fillText(l, ax + s * 0.6, lineY - b.lh * 0.12);
          }
        });
      } else {
        check(ctx, x + s * 0.42, cy + b.lh - s * 0.34, s * 0.42, t.acento, t.sobreAcento);
        ctx.fillStyle = t.texto;
        b.lineas.forEach((l, j) => ctx.fillText(l, x + s * 1.3, cy + b.lh * (j + 1) - b.lh * 0.12));
      }
      cy += b.lineas.length * b.lh;
    });
  }

  if (m.precio || m.anterior) {
    cy += 34;
    if (m.anterior) {
      const s = Math.round(38 * escala);
      ctx.font = font(500, s, F_CUERPO);
      ctx.fillStyle = t.suave;
      cy += 44 * escala;
      ctx.fillText(m.anterior, ax, cy - 6);
      const tw = ctx.measureText(m.anterior).width;
      const lx = centrado ? ax - tw / 2 : ax;
      ctx.strokeStyle = t.suave;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(lx - 4, cy - 6 - s * 0.32);
      ctx.lineTo(lx + tw + 4, cy - 6 - s * 0.32);
      ctx.stroke();
    }
    if (m.precio) {
      ctx.font = font(800, m.precioSize, F_TITULO);
      ctx.fillStyle = t.acento;
      cy += m.precioSize * 0.92;
      ctx.fillText(m.precio, ax, cy - m.precioSize * 0.06);
    }
    if (m.leyenda) {
      ctx.font = font(500, Math.round(28 * escala), F_CUERPO);
      ctx.fillStyle = t.suave;
      cy += 40 * escala;
      ctx.fillText(m.leyenda, ax, cy - 2);
    }
  }

  if (m.cta) {
    cy += 30;
    const s = Math.round(32 * escala);
    ctx.font = font(700, s, F_TITULO);
    const tw = ctx.measureText(m.cta).width;
    const bh = 76 * escala;
    const iconW = s * 1.4;
    const bw = Math.min(w, tw + iconW + 64);
    const bx = centrado ? x + (w - bw) / 2 : x;
    ctx.fillStyle = t.ctaBg;
    rr(ctx, bx, cy, bw, bh, bh / 2);
    ctx.fill();
    iconoWhatsapp(ctx, bx + 32 + s * 0.55, cy + bh / 2, s * 0.55, t.ctaTexto);
    ctx.fillStyle = t.ctaTexto;
    ctx.textAlign = "left";
    ctx.fillText(m.cta, bx + 32 + iconW, cy + bh / 2 + s * 0.36);
    cy += bh;
  }
  ctx.textAlign = "left";
}

function cuerpoStack(ctx: CanvasRenderingContext2D, input: RenderInput, t: Tema, x0: number, top: number, x1: number, bottom: number) {
  const { cfg } = input;
  const w = x1 - x0;
  const promo = cfg.plantilla === "promo";
  const alto = bottom - top;
  const minProducto = cfg.formato === "story" ? 440 : cfg.formato === "vertical" ? 330 : 300;
  let escala = 1;
  let m = medirTexto(ctx, cfg, w, escala, promo);
  while (alto - m.alto - 40 < minProducto && escala > 0.8) {
    escala -= 0.04;
    m = medirTexto(ctx, cfg, w, escala, promo);
  }
  const prodH = Math.max(200, alto - m.alto - 40);
  const textoY = bottom - m.alto;
  dibujarProducto(ctx, input, t, x0, top, w, prodH);
  dibujarTexto(ctx, m, t, x0, textoY, w, t.centrado, escala);
}

function cuerpoSplit(ctx: CanvasRenderingContext2D, input: RenderInput, t: Tema, x0: number, top: number, x1: number, bottom: number) {
  const { cfg } = input;
  const total = x1 - x0;
  const prodW = Math.round(total * 0.5);
  const gap = 36;
  const textX = x0 + prodW + gap;
  const textW = x1 - textX;
  const alto = bottom - top;
  let escala = 0.84;
  let m = medirTexto(ctx, cfg, textW, escala, cfg.plantilla === "promo");
  while (m.alto > alto && escala > 0.5) {
    escala -= 0.04;
    m = medirTexto(ctx, cfg, textW, escala, cfg.plantilla === "promo");
  }
  dibujarProducto(ctx, input, t, x0 - 10, top, prodW + 10, alto);
  const ty = top + Math.max(0, (alto - m.alto) / 2);
  dibujarTexto(ctx, m, t, textX, ty, textW, false, escala);
}
