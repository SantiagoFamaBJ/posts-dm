import { formatearPrecio } from "./render";
import type { Marca, PostConfig, Revendedor } from "./types";

export function generarCopy(cfg: PostConfig, marca: Marca | null, rev: Revendedor) {
  const l: string[] = [];
  const titulo = cfg.titulo.trim();
  l.push(cfg.mostrarBadge && cfg.badgeTexto ? `${cfg.badgeTexto.trim().toUpperCase()} ✨ ${titulo}` : `✨ ${titulo}`);
  if (marca) l.push(`de ${marca.nombre}`);
  if (cfg.subtitulo.trim()) l.push("", cfg.subtitulo.trim());
  const ben = cfg.beneficios.filter((b) => b.trim());
  if (cfg.mostrarBeneficios && ben.length) {
    l.push("");
    ben.forEach((b) => l.push(`✅ ${b.trim()}`));
  }
  if (cfg.mostrarPrecio && cfg.precio.trim()) {
    l.push("");
    const ant = cfg.mostrarPrecioAnterior && cfg.precioAnterior.trim() ? `Antes ${formatearPrecio(cfg.precioAnterior)} → ` : "";
    l.push(`💲 ${ant}${formatearPrecio(cfg.precio)}${cfg.leyendaPrecio.trim() ? ` (${cfg.leyendaPrecio.trim()})` : ""}`);
  }
  l.push("");
  if (rev.whatsapp) l.push(`📲 Pedilo por WhatsApp: ${rev.whatsapp}`);
  if (rev.direccion || rev.ciudad) l.push(`📍 ${[rev.direccion, rev.ciudad].filter(Boolean).join(", ")}`);
  if (rev.instagram) l.push(`📸 @${rev.instagram.replace(/^@/, "")}`);
  l.push("");
  const tags = ["#odontologia", "#insumosodontologicos", "#odontologos"];
  if (marca) tags.unshift("#" + marca.nombre.toLowerCase().replace(/[^a-z0-9]/g, ""));
  l.push(tags.join(" "));
  return l.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
