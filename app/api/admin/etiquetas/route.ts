import { crud, num, solo, txt } from "@/lib/crud";

export const dynamic = "force-dynamic";

const r = crud(
  "posts_etiquetas",
  (b, creando) => {
    const texto = txt(b.texto, 22);
    if (creando && !texto) return "Escribí la etiqueta";
    return solo(b, { texto: texto?.toUpperCase() || null, orden: num(b.orden) ?? 0 }, creando);
  },
  ["orden", "texto"],
);

export const { GET, POST, PUT, DELETE } = r;
