"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, storage } from "@/lib/client";
import { generarCopy } from "@/lib/copy";
import { cargarFuentes, loadImage, renderPost } from "@/lib/render";
import { FORMATOS, PLANTILLAS, type Formato, type Marca, type Plantilla, type PostConfig, type Producto, type Revendedor } from "@/lib/types";
import Perfil from "./Perfil";
import { Aviso, Campo, LogoDM, Modal, Seccion, Toggle } from "./ui";

const BADGES = ["NUEVO", "PROMO", "OFERTA", "ÚLTIMAS UNIDADES", "LANZAMIENTO"];
const LEYENDAS = ["Precio contado", "Hasta agotar stock", "+ IVA", "Precio por unidad"];

function base(rev: Revendedor): PostConfig {
  return {
    plantilla: "destacado",
    formato: "vertical",
    fondo: "claro",
    colorAcento: rev.color || "#f15922",
    titulo: "",
    subtitulo: "",
    mostrarBeneficios: true,
    beneficios: [],
    mostrarPrecio: false,
    precio: "",
    mostrarPrecioAnterior: false,
    precioAnterior: "",
    leyendaPrecio: "",
    mostrarBadge: false,
    badgeTexto: "NUEVO",
    mostrarCta: true,
    ctaTexto: "Pedilo por WhatsApp",
    mostrarLogoMarca: true,
    mostrarWhatsapp: true,
    mostrarInstagram: true,
    mostrarDireccion: false,
    escalaProducto: 1,
  };
}

// Preferencias de diseño que se recuerdan entre posteos
const RECORDAR: (keyof PostConfig)[] = [
  "plantilla", "formato", "fondo", "mostrarCta", "ctaTexto", "mostrarLogoMarca",
  "mostrarWhatsapp", "mostrarInstagram", "mostrarDireccion", "mostrarBeneficios",
];

export default function Editor({ revInicial }: { revInicial: Revendedor }) {
  const [rev, setRev] = useState(revInicial);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [producto, setProducto] = useState<Producto | null>(null);
  const [cfg, setCfg] = useState<PostConfig>(() => base(revInicial));
  const [colorManual, setColorManual] = useState(false);
  const [fotoPropia, setFotoPropia] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [perfil, setPerfil] = useState(!revInicial.whatsapp && !revInicial.logo_url);
  const [copy, setCopy] = useState("");
  const [aviso, setAviso] = useState("");
  const [descargando, setDescargando] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clave = `postsdm:${rev.slug}`;

  const marca = useMemo(() => marcas.find((m) => m.id === producto?.marca_id) || null, [marcas, producto]);

  const avisar = (t: string) => {
    setAviso(t);
    setTimeout(() => setAviso(""), 2200);
  };

  useEffect(() => {
    api<{ marcas: Marca[]; productos: Producto[] }>("/api/catalogo")
      .then((d) => {
        setMarcas(d.marcas);
        setProductos(d.productos);
      })
      .catch(() => avisar("No se pudo cargar el catálogo"))
      .finally(() => setCargando(false));
    const prefs = storage<Partial<PostConfig>>(clave);
    if (prefs) setCfg((c) => ({ ...c, ...prefs }));
  }, [clave]);

  const set = useCallback(<K extends keyof PostConfig>(k: K, v: PostConfig[K]) => {
    setCfg((c) => ({ ...c, [k]: v }));
  }, []);

  // guardar preferencias
  useEffect(() => {
    const p: Partial<PostConfig> = {};
    RECORDAR.forEach((k) => ((p as Record<string, unknown>)[k] = cfg[k]));
    storage(clave, p);
  }, [cfg, clave]);

  function elegir(p: Producto) {
    setProducto(p);
    setFotoPropia(null);
    const m = marcas.find((x) => x.id === p.marca_id);
    setCfg((c) => ({
      ...c,
      titulo: p.nombre,
      subtitulo: "",
      beneficios: (p.beneficios || []).slice(0, 3),
      precio: p.precio ? String(Math.round(p.precio)) : "",
      precioAnterior: p.precio_anterior ? String(Math.round(p.precio_anterior)) : "",
      mostrarPrecioAnterior: c.mostrarPrecioAnterior && !!p.precio_anterior,
      colorAcento: colorManual ? c.colorAcento : rev.color || m?.color || "#f15922",
      escalaProducto: 1,
    }));
    setPicker(false);
  }

  // Render del preview
  useEffect(() => {
    let vivo = true;
    (async () => {
      await cargarFuentes();
      const [imgProducto, imgMarca, imgRevendedor] = await Promise.all([
        loadImage(fotoPropia || producto?.imagen_png || producto?.imagen_url),
        loadImage(marca?.logo_url),
        loadImage(rev.logo_url),
      ]);
      if (!vivo || !canvasRef.current) return;
      renderPost(canvasRef.current, { cfg, producto, marca, revendedor: rev, imgProducto, imgMarca, imgRevendedor });
    })();
    return () => {
      vivo = false;
    };
  }, [cfg, producto, marca, rev, fotoPropia]);

  useEffect(() => {
    setCopy(producto ? generarCopy(cfg, marca, rev) : "");
  }, [cfg, marca, rev, producto]);

  async function descargar() {
    const c = canvasRef.current;
    if (!c || !producto) return;
    setDescargando(true);
    try {
      const blob = await new Promise<Blob | null>((res) => c.toBlob(res, "image/png"));
      if (!blob) throw new Error();
      const nombre = `${rev.slug}-${producto.nombre}-${cfg.formato}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80) + ".png";
      const file = new File([blob], nombre, { type: "image/png" });
      const tactil = window.matchMedia("(pointer: coarse)").matches;
      let compartido = false;
      if (tactil && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          compartido = true;
        } catch (e) {
          if ((e as Error).name === "AbortError") return;
        }
      }
      if (!compartido) {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = nombre;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      }
      avisar("¡Listo! Imagen descargada");
      fetch("/api/descargas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: rev.slug, producto_id: producto.id, plantilla: cfg.plantilla, formato: cfg.formato }),
      }).catch(() => {});
    } catch {
      avisar("No se pudo generar la imagen");
    } finally {
      setDescargando(false);
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(copy);
      avisar("Texto copiado");
    } catch {
      avisar("No se pudo copiar");
    }
  }

  const coloresSugeridos = [
    ...(marca?.color ? [{ c: marca.color, n: marca.nombre }] : []),
    ...(rev.color ? [{ c: rev.color, n: "Tu color" }] : []),
    { c: "#f15922", n: "Naranja" },
    { c: "#16181d", n: "Negro" },
    { c: "#0b4ea2", n: "Azul" },
    { c: "#00843d", n: "Verde" },
  ].filter((x, i, a) => a.findIndex((y) => y.c.toLowerCase() === x.c.toLowerCase()) === i);

  return (
    <div className="min-h-screen pb-28 lg:pb-10">
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <LogoDM className="text-xl" />
          <button onClick={() => setPerfil(true)} className="flex min-w-0 items-center gap-2 rounded-full border border-neutral-200 py-1 pl-1 pr-3 text-sm font-semibold">
            <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-neutral-100">
              {rev.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={rev.logo_url} alt="" className="h-full w-full object-contain p-0.5" />
              ) : (
                <span className="text-xs">✎</span>
              )}
            </span>
            <span className="truncate">{rev.nombre}</span>
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-5 px-4 pt-5 lg:grid-cols-[minmax(0,1fr)_440px]">
        {/* Preview */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <div className="tarjeta overflow-hidden p-3 sm:p-4">
            <div className="relative grid place-items-center rounded-xl bg-[repeating-conic-gradient(#efefef_0_25%,#f8f8f8_0_50%)] bg-[length:24px_24px] p-3">
              <canvas
                ref={canvasRef}
                className="block h-auto max-h-[62vh] w-auto max-w-full rounded-lg shadow-xl lg:max-h-[72vh]"
                style={{ aspectRatio: `${FORMATOS[cfg.formato].w} / ${FORMATOS[cfg.formato].h}` }}
              />
              {!producto && (
                <div className="absolute inset-0 grid place-items-center p-6">
                  <button onClick={() => setPicker(true)} className="btn-dm px-6 py-4 text-base shadow-lg">
                    Elegí un producto para empezar
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="mt-3 hidden gap-3 lg:flex">
            <button className="btn-dm flex-1 py-3.5 text-base" disabled={!producto || descargando} onClick={descargar}>
              {descargando ? "Generando…" : "Descargar imagen"}
            </button>
            <button className="btn-ghost py-3.5" disabled={!producto} onClick={copiar}>
              Copiar texto
            </button>
          </div>
        </div>

        {/* Controles */}
        <div className="space-y-4">
          <Seccion titulo="Producto" numero={1}>
            <button onClick={() => setPicker(true)} className="flex w-full items-center gap-3 rounded-xl border border-neutral-200 p-2.5 text-left transition hover:border-dm">
              <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-neutral-50">
                {producto && (producto.imagen_png || producto.imagen_url) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={producto.imagen_png || producto.imagen_url || ""} alt="" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-2xl text-neutral-300">+</span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{producto ? producto.nombre : cargando ? "Cargando catálogo…" : "Elegir producto"}</span>
                <span className="block text-sm text-neutral-500">
                  {producto ? [marca?.nombre, producto.sku ? `Cód. ${producto.sku}` : ""].filter(Boolean).join(" · ") : `${productos.length} productos disponibles`}
                </span>
              </span>
              <span className="text-sm font-bold text-dm">{producto ? "Cambiar" : "Elegir"}</span>
            </button>
            {producto && (
              <div className="flex flex-wrap items-center gap-2">
                <label className="btn-ghost cursor-pointer text-xs">
                  Usar mi propia foto
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setFotoPropia(URL.createObjectURL(f));
                    }}
                  />
                </label>
                {fotoPropia && (
                  <button className="text-sm text-neutral-500 underline" onClick={() => setFotoPropia(null)}>
                    Volver a la foto original
                  </button>
                )}
              </div>
            )}
          </Seccion>

          <Seccion titulo="Diseño" numero={2}>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(PLANTILLAS) as Plantilla[]).map((p) => (
                <button
                  key={p}
                  onClick={() => set("plantilla", p)}
                  className={`rounded-xl border-2 p-2.5 text-left transition ${cfg.plantilla === p ? "border-dm bg-dm/5" : "border-neutral-200"}`}
                >
                  <MiniPlantilla p={p} color={cfg.colorAcento} />
                  <span className="mt-2 block text-sm font-bold">{PLANTILLAS[p].label}</span>
                  <span className="block text-xs leading-tight text-neutral-500">{PLANTILLAS[p].desc}</span>
                </button>
              ))}
            </div>

            <div>
              <span className="mb-1.5 block text-sm font-semibold text-neutral-600">Formato</span>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(FORMATOS) as Formato[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => set("formato", f)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border-2 py-2.5 text-xs font-bold transition ${cfg.formato === f ? "border-dm bg-dm/5 text-dm" : "border-neutral-200 text-neutral-600"}`}
                  >
                    <span
                      className={`block rounded-[3px] border-2 ${cfg.formato === f ? "border-dm" : "border-neutral-400"}`}
                      style={{ width: 22, height: (22 * FORMATOS[f].h) / FORMATOS[f].w }}
                    />
                    {FORMATOS[f].label}
                  </button>
                ))}
              </div>
            </div>

            {cfg.plantilla !== "promo" && (
              <div>
                <span className="mb-1.5 block text-sm font-semibold text-neutral-600">Fondo</span>
                <div className="flex gap-2">
                  {(["claro", "oscuro"] as const).map((f) => (
                    <button key={f} onClick={() => set("fondo", f)} className={`chip flex-1 capitalize ${cfg.fondo === f ? "chip-on" : ""}`}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <span className="mb-1.5 block text-sm font-semibold text-neutral-600">Color principal</span>
              <div className="flex flex-wrap items-center gap-2">
                {coloresSugeridos.map((x) => (
                  <button
                    key={x.c}
                    title={x.n}
                    onClick={() => {
                      set("colorAcento", x.c);
                      setColorManual(true);
                    }}
                    className={`h-9 w-9 rounded-full border-2 ${cfg.colorAcento.toLowerCase() === x.c.toLowerCase() ? "border-tinta ring-2 ring-tinta/20" : "border-white shadow"}`}
                    style={{ background: x.c }}
                  />
                ))}
                <label className="relative h-9 w-9 cursor-pointer overflow-hidden rounded-full border-2 border-white bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)] shadow" title="Otro color">
                  <input
                    type="color"
                    className="absolute inset-0 opacity-0"
                    value={cfg.colorAcento}
                    onChange={(e) => {
                      set("colorAcento", e.target.value);
                      setColorManual(true);
                    }}
                  />
                </label>
              </div>
            </div>

            {producto && (
              <Campo label={`Tamaño del producto: ${Math.round(cfg.escalaProducto * 100)}%`}>
                <input
                  type="range"
                  min={0.6}
                  max={1.3}
                  step={0.05}
                  value={cfg.escalaProducto}
                  onChange={(e) => set("escalaProducto", Number(e.target.value))}
                  className="w-full accent-[#f15922]"
                />
              </Campo>
            )}
          </Seccion>

          <Seccion titulo="Textos" numero={3}>
            <Campo label="Título">
              <textarea rows={2} className="campo resize-none" value={cfg.titulo} onChange={(e) => set("titulo", e.target.value)} />
            </Campo>
            <Campo label="Bajada (opcional)">
              <input className="campo" placeholder="Ej: Ideal para restauraciones del sector anterior" value={cfg.subtitulo} onChange={(e) => set("subtitulo", e.target.value)} />
            </Campo>

            <div className="border-t border-neutral-100 pt-2">
              <Toggle on={cfg.mostrarBeneficios} onChange={(v) => set("mostrarBeneficios", v)} label="Mostrar beneficios" />
              {cfg.mostrarBeneficios && (
                <div className="mt-1 space-y-2">
                  {cfg.beneficios.map((b, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        className="campo"
                        value={b}
                        onChange={(e) => set("beneficios", cfg.beneficios.map((x, j) => (j === i ? e.target.value : x)))}
                      />
                      <button
                        className="grid w-11 shrink-0 place-items-center rounded-xl border border-neutral-200 text-lg text-neutral-500"
                        onClick={() => set("beneficios", cfg.beneficios.filter((_, j) => j !== i))}
                        aria-label="Quitar"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {cfg.beneficios.length < 4 && (
                    <button className="text-sm font-bold text-dm" onClick={() => set("beneficios", [...cfg.beneficios, ""])}>
                      + Agregar beneficio
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-neutral-100 pt-2">
              <Toggle on={cfg.mostrarBadge} onChange={(v) => set("mostrarBadge", v)} label="Etiqueta destacada" sub="NUEVO, PROMO, OFERTA…" />
              {cfg.mostrarBadge && (
                <div className="mt-1 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {BADGES.map((b) => (
                      <button key={b} onClick={() => set("badgeTexto", b)} className={`chip ${cfg.badgeTexto === b ? "chip-on" : ""}`}>
                        {b}
                      </button>
                    ))}
                  </div>
                  <input className="campo" maxLength={22} placeholder="O escribí la tuya" value={cfg.badgeTexto} onChange={(e) => set("badgeTexto", e.target.value)} />
                </div>
              )}
            </div>
          </Seccion>

          <Seccion titulo="Precio" numero={4}>
            <Toggle on={cfg.mostrarPrecio} onChange={(v) => set("mostrarPrecio", v)} label="Mostrar precio" sub="Si no, el post sale sin precio" />
            {cfg.mostrarPrecio && (
              <>
                <Campo label="Precio" ayuda="Poné tu precio de venta. Ej: 25000">
                  <input className="campo" inputMode="decimal" value={cfg.precio} onChange={(e) => set("precio", e.target.value)} />
                </Campo>
                <Toggle on={cfg.mostrarPrecioAnterior} onChange={(v) => set("mostrarPrecioAnterior", v)} label="Precio anterior tachado" />
                {cfg.mostrarPrecioAnterior && (
                  <input className="campo" inputMode="decimal" placeholder="Ej: 30000" value={cfg.precioAnterior} onChange={(e) => set("precioAnterior", e.target.value)} />
                )}
                <Campo label="Aclaración (opcional)">
                  <div className="mb-2 flex flex-wrap gap-2">
                    {LEYENDAS.map((l) => (
                      <button key={l} type="button" onClick={() => set("leyendaPrecio", cfg.leyendaPrecio === l ? "" : l)} className={`chip ${cfg.leyendaPrecio === l ? "chip-on" : ""}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                  <input className="campo" value={cfg.leyendaPrecio} onChange={(e) => set("leyendaPrecio", e.target.value)} />
                </Campo>
              </>
            )}
          </Seccion>

          <Seccion titulo="Cierre y datos" numero={5}>
            <Toggle on={cfg.mostrarCta} onChange={(v) => set("mostrarCta", v)} label="Botón de llamado" />
            {cfg.mostrarCta && <input className="campo" maxLength={32} value={cfg.ctaTexto} onChange={(e) => set("ctaTexto", e.target.value)} />}
            <div className="divide-y divide-neutral-100 border-t border-neutral-100">
              <Toggle on={cfg.mostrarLogoMarca} onChange={(v) => set("mostrarLogoMarca", v)} label="Logo de la marca" />
              <Toggle on={cfg.mostrarWhatsapp} onChange={(v) => set("mostrarWhatsapp", v)} label="Mi WhatsApp" sub={rev.whatsapp || "No cargado"} />
              <Toggle on={cfg.mostrarInstagram} onChange={(v) => set("mostrarInstagram", v)} label="Mi Instagram" sub={rev.instagram ? "@" + rev.instagram.replace(/^@/, "") : "No cargado"} />
              <Toggle on={cfg.mostrarDireccion} onChange={(v) => set("mostrarDireccion", v)} label="Mi dirección" sub={[rev.direccion, rev.ciudad].filter(Boolean).join(", ") || "No cargada"} />
            </div>
            <button className="text-sm font-bold text-dm" onClick={() => setPerfil(true)}>
              Editar mis datos y logo →
            </button>
          </Seccion>

          {producto && (
            <Seccion titulo="Texto para la publicación">
              <textarea rows={9} className="campo text-[15px] leading-snug" value={copy} onChange={(e) => setCopy(e.target.value)} />
              <button className="btn-ghost w-full" onClick={copiar}>
                Copiar texto
              </button>
            </Seccion>
          )}
        </div>
      </main>

      {/* Barra fija en celular */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white/95 p-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-6xl gap-2">
          <button className="btn-dm flex-1 py-3.5 text-base" disabled={!producto || descargando} onClick={descargar}>
            {descargando ? "Generando…" : "Descargar imagen"}
          </button>
          <button className="btn-ghost px-4 py-3.5" disabled={!producto} onClick={copiar}>
            Copiar texto
          </button>
        </div>
      </div>

      <Selector abierto={picker} onCerrar={() => setPicker(false)} marcas={marcas} productos={productos} onElegir={elegir} />

      <Modal abierto={perfil} onCerrar={() => setPerfil(false)} titulo={!revInicial.whatsapp && !revInicial.logo_url ? "¡Bienvenido!" : "Mis datos"}>
        <Perfil
          rev={rev}
          primeraVez={!revInicial.whatsapp && !revInicial.logo_url && !rev.whatsapp}
          onGuardado={(r) => {
            setRev(r);
            if (!colorManual && r.color) set("colorAcento", r.color);
            setPerfil(false);
            avisar("Datos guardados");
          }}
        />
      </Modal>

      <Aviso texto={aviso} />
    </div>
  );
}

function Selector({
  abierto,
  onCerrar,
  marcas,
  productos,
  onElegir,
}: {
  abierto: boolean;
  onCerrar: () => void;
  marcas: Marca[];
  productos: Producto[];
  onElegir: (p: Producto) => void;
}) {
  const [q, setQ] = useState("");
  const [marca, setMarca] = useState<string | null>(null);
  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const termino = norm(q.trim());
  const lista = productos
    .filter((p) => (!marca || p.marca_id === marca) && (!termino || norm(p.nombre).includes(termino) || norm(p.sku || "").includes(termino)))
    .sort((a, b) => {
      // si busca un código, el que coincide exacto va primero
      if (!termino) return 0;
      const ea = norm(a.sku || "") === termino ? 0 : 1;
      const eb = norm(b.sku || "") === termino ? 0 : 1;
      return ea - eb;
    });
  const visibles = lista.slice(0, 120);
  const conProductos = marcas.filter((m) => productos.some((p) => p.marca_id === m.id));
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Elegí un producto" ancho="max-w-3xl">
      <input className="campo mb-3" autoFocus placeholder="Buscar por nombre o código…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
        <button onClick={() => setMarca(null)} className={`chip shrink-0 ${!marca ? "chip-on" : ""}`}>
          Todas
        </button>
        {conProductos.map((m) => (
          <button key={m.id} onClick={() => setMarca(m.id)} className={`chip shrink-0 ${marca === m.id ? "chip-on" : ""}`}>
            {m.nombre}
          </button>
        ))}
      </div>
      {lista.length === 0 ? (
        <p className="py-10 text-center text-neutral-500">No encontramos productos.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {visibles.map((p) => (
            <button key={p.id} onClick={() => onElegir(p)} className="tarjeta overflow-hidden text-left transition hover:border-dm hover:shadow-md">
              <span className="block aspect-square bg-white p-3">
                {p.imagen_png || p.imagen_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imagen_png || p.imagen_url || ""} alt="" loading="lazy" className="h-full w-full object-contain" />
                ) : (
                  <span className="grid h-full place-items-center text-xs text-neutral-400">Sin imagen</span>
                )}
              </span>
              <span className="block border-t border-neutral-100 p-2.5">
                <span className="block text-[11px] font-bold uppercase tracking-wide text-dm">{marcas.find((m) => m.id === p.marca_id)?.nombre}</span>
                <span className="line-clamp-2 text-sm font-semibold leading-tight">{p.nombre}</span>
                {p.sku && <span className="mt-0.5 block text-xs text-neutral-400">Cód. {p.sku}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
      {lista.length > visibles.length && (
        <p className="mt-4 text-center text-sm text-neutral-500">
          Mostrando {visibles.length} de {lista.length}. Escribí el nombre o código para encontrarlo más rápido.
        </p>
      )}
    </Modal>
  );
}

function MiniPlantilla({ p, color }: { p: Plantilla; color: string }) {
  if (p === "promo")
    return (
      <span className="block aspect-[4/5] rounded-md p-1.5" style={{ background: color }}>
        <span className="mx-auto mt-1 block h-[42%] w-[62%] rounded-full bg-white" />
        <span className="mx-auto mt-1.5 block h-1.5 w-3/4 rounded bg-white/80" />
        <span className="mx-auto mt-1 block h-2.5 w-1/2 rounded bg-white" />
        <span className="mt-1.5 block h-2 rounded-sm bg-white" />
      </span>
    );
  if (p === "minimal")
    return (
      <span className="block aspect-[4/5] rounded-md bg-[#f4f2ee] p-1.5">
        <span className="mx-auto mt-1 block h-[48%] w-[56%] rounded bg-neutral-300" />
        <span className="mx-auto mt-1.5 block h-1.5 w-3/4 rounded bg-neutral-700" />
        <span className="mx-auto mt-1 block h-1.5 w-1/3 rounded" style={{ background: color }} />
        <span className="mt-2 block h-px bg-neutral-300" />
      </span>
    );
  return (
    <span className="relative block aspect-[4/5] overflow-hidden rounded-md bg-white p-1.5 ring-1 ring-neutral-200">
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: color }} />
      <span className="mx-auto mt-1 block h-[40%] w-[62%] rounded-full" style={{ background: color, opacity: 0.18 }} />
      <span className="mt-1.5 block h-1.5 w-3/4 rounded bg-neutral-800" />
      <span className="mt-1 block h-1 w-1/2 rounded bg-neutral-300" />
      <span className="mt-1 block h-1 w-1/2 rounded bg-neutral-300" />
      <span className="absolute inset-x-0 bottom-0 h-2.5 bg-neutral-800" />
    </span>
  );
}
