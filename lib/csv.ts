// Lector de CSV (soporta comillas, comas y saltos de línea dentro de campos, y ; como separador)

export function parseCsv(texto: string): Record<string, string>[] {
  const t = texto.replace(/^﻿/, "");
  const primera = t.slice(0, t.indexOf("\n") > 0 ? t.indexOf("\n") : t.length);
  const sep = (primera.match(/;/g) || []).length > (primera.match(/,/g) || []).length ? ";" : ",";

  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let comillas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (comillas) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          campo += '"';
          i++;
        } else comillas = false;
      } else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === sep) {
      fila.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = "";
    } else campo += c;
  }
  if (campo || fila.length) {
    fila.push(campo);
    filas.push(fila);
  }
  const [cab, ...resto] = filas.filter((f) => f.some((x) => x.trim()));
  if (!cab) return [];
  const claves = cab.map((h) => h.trim());
  return resto.map((f) => Object.fromEntries(claves.map((k, i) => [k, (f[i] ?? "").trim()])));
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

// Busca una columna por varios nombres posibles (export de WooCommerce en español o inglés, o un Excel propio)
export function columna(fila: Record<string, string>, opciones: string[]) {
  const keys = Object.keys(fila);
  for (const o of opciones) {
    const k = keys.find((k) => norm(k) === norm(o));
    if (k && fila[k]) return fila[k];
  }
  return "";
}

export type FilaProducto = {
  wc_id: number | null;
  sku: string | null;
  nombre: string;
  tipo: string;
  publicado: boolean;
  imagen: string | null;
  html_corto: string;
  html_largo: string;
  precio: number | null;
  precio_anterior: number | null;
  categoria: string | null;
  marca: string | null;
};

function numero(v: string) {
  if (!v) return null;
  let s = v.replace(/\$/g, "").replace(/\s/g, "");
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(",", ".");
  const n = Number(s);
  return isNaN(n) || n <= 0 ? null : n;
}

export function filasAProductos(filas: Record<string, string>[]): FilaProducto[] {
  return filas
    .map((f) => {
      const normal = numero(columna(f, ["Precio normal", "Regular price", "Precio", "Price"]));
      const rebajado = numero(columna(f, ["Precio rebajado", "Sale price", "Precio oferta"]));
      const cat = columna(f, ["Categorías", "Categories", "Categoría", "Categoria", "Rubro"]);
      const imagenes = columna(f, ["Imágenes", "Images", "Imagen", "Image", "Foto"]);
      const publicado = columna(f, ["Publicado", "Published"]);
      const id = Number(columna(f, ["ID", "Id"]));
      return {
        wc_id: id > 0 ? id : null,
        sku: columna(f, ["SKU", "Código", "Codigo", "Cód", "Cod", "Code", "Artículo", "Articulo"]) || null,
        nombre: columna(f, ["Nombre", "Name", "Producto", "Descripción artículo", "Titulo", "Título"]),
        tipo: columna(f, ["Tipo", "Type"]).toLowerCase(),
        publicado: publicado === "" ? true : publicado !== "0" && publicado !== "-1",
        imagen: imagenes.split(",")[0]?.trim() || null,
        html_corto: columna(f, ["Descripción corta", "Short description"]),
        html_largo: columna(f, ["Descripción", "Description"]),
        precio: rebajado || normal,
        precio_anterior: rebajado && normal && rebajado < normal ? normal : null,
        categoria: cat ? cat.split(",")[0].split(">").pop()!.trim() : null,
        marca: columna(f, ["Marcas", "Brands", "Marca", "Brand", "Fabricante"]) || null,
      };
    })
    .filter((p) => p.nombre);
}
