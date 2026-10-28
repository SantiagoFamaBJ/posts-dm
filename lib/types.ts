export type Marca = {
  id: string;
  nombre: string;
  logo_url: string | null;
  color: string;
  orden: number;
  activo: boolean;
};

export type Producto = {
  id: string;
  wc_id: number | null;
  sku: string | null;
  nombre: string;
  marca_id: string | null;
  imagen_url: string | null;
  imagen_png: string | null;
  descripcion: string | null;
  beneficios: string[];
  precio: number | null;
  precio_anterior: number | null;
  categoria: string | null;
  url_web: string | null;
  activo: boolean;
  orden: number;
};

export type Revendedor = {
  id: string;
  slug: string;
  nombre: string;
  logo_url: string | null;
  whatsapp: string | null;
  instagram: string | null;
  direccion: string | null;
  ciudad: string | null;
  color: string | null;
  activo: boolean;
};

export type Plantilla = "destacado" | "promo" | "minimal";
export type Formato = "cuadrado" | "vertical" | "story";
export type Fondo = "claro" | "oscuro";

export type PostConfig = {
  plantilla: Plantilla;
  formato: Formato;
  fondo: Fondo;
  colorAcento: string;
  titulo: string;
  subtitulo: string;
  mostrarBeneficios: boolean;
  beneficios: string[];
  mostrarPrecio: boolean;
  precio: string;
  mostrarPrecioAnterior: boolean;
  precioAnterior: string;
  leyendaPrecio: string;
  mostrarBadge: boolean;
  badgeTexto: string;
  mostrarCta: boolean;
  ctaTexto: string;
  mostrarLogoMarca: boolean;
  mostrarWhatsapp: boolean;
  mostrarInstagram: boolean;
  mostrarDireccion: boolean;
  escalaProducto: number;
  rotacion: number;
  fondoLogo: boolean;
  posProducto: Punto;
  posLogo: Punto;
  posBadge: Punto;
};

export type Punto = { x: number; y: number };

export type Etiqueta = { id: string; texto: string; orden: number };

export const FORMATOS: Record<Formato, { w: number; h: number; label: string }> = {
  cuadrado: { w: 1080, h: 1080, label: "Feed cuadrado" },
  vertical: { w: 1080, h: 1350, label: "Feed vertical" },
  story: { w: 1080, h: 1920, label: "Story" },
};

export const PLANTILLAS: Record<Plantilla, { label: string; desc: string }> = {
  destacado: { label: "Destacado", desc: "Producto + beneficios" },
  promo: { label: "Promo", desc: "Fondo color, precio grande" },
  minimal: { label: "Minimal", desc: "Limpio y centrado" },
};
