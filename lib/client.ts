"use client";

export async function api<T = unknown>(url: string, opts: RequestInit & { body?: BodyInit | null } = {}): Promise<T> {
  const r = await fetch(url, {
    ...opts,
    headers: opts.body && !(opts.body instanceof FormData) ? { "Content-Type": "application/json", ...opts.headers } : opts.headers,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as { error?: string }).error || "Algo salió mal");
  return data as T;
}

// Achica la imagen antes de subirla (máx. 1400px). Mantiene PNG si puede tener transparencia.
export async function prepararImagen(file: File, max = 1400): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const k = Math.min(1, max / Math.max(img.width, img.height));
    if (k === 1 && file.size < 1.5 * 1024 * 1024 && ["image/png", "image/jpeg", "image/webp"].includes(file.type)) return file;
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    const png = file.type === "image/png" || file.type === "image/webp";
    const blob = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), png ? "image/png" : "image/jpeg", 0.9));
    return new File([blob], png ? "imagen.png" : "imagen.jpg", { type: blob.type });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function subirImagen(file: File, carpeta: "marcas" | "productos" | "revendedores", slug?: string) {
  const f = await prepararImagen(file);
  const fd = new FormData();
  fd.append("file", f);
  fd.append("carpeta", carpeta);
  if (slug) fd.append("slug", slug);
  const { url } = await api<{ url: string }>("/api/upload", { method: "POST", body: fd });
  return url;
}

export function storage<T>(clave: string, valor?: T): T | null {
  try {
    if (valor === undefined) {
      const v = localStorage.getItem(clave);
      return v ? (JSON.parse(v) as T) : null;
    }
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    /* sin almacenamiento */
  }
  return null;
}
