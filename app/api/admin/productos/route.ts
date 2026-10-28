import { bool, crud, num, solo, txt } from "@/lib/crud";

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
      marca_id: txt(b.marca_id, 60),
      imagen_url: txt(b.imagen_url, 500),
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
