import { bool, color, crud, num, solo, txt } from "@/lib/crud";

export const dynamic = "force-dynamic";

const r = crud("posts_marcas", (b, creando) => {
  const nombre = txt(b.nombre, 80);
  if (creando && !nombre) return "El nombre es obligatorio";
  return solo(
    b,
    {
      nombre,
      logo_url: txt(b.logo_url, 500),
      color: color(b.color) || "#f15922",
      orden: num(b.orden) ?? 0,
      activo: bool(b.activo),
    },
    creando,
  );
});

export const { GET, POST, PUT, DELETE } = r;
