"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, subirImagen } from "@/lib/client";
import { filasAProductos, parseCsv, type FilaProducto } from "@/lib/csv";
import type { Marca, Producto, Revendedor } from "@/lib/types";
import { Aviso, Campo, LogoDM, Modal, Toggle } from "./ui";

type Tab = "productos" | "importar" | "png" | "marcas" | "revendedores" | "stats";
const TABS: { id: Tab; label: string }[] = [
  { id: "productos", label: "Productos" },
  { id: "importar", label: "Importar de la web" },
  { id: "png", label: "Fotos PNG" },
  { id: "marcas", label: "Marcas" },
  { id: "revendedores", label: "Revendedores" },
  { id: "stats", label: "Estadísticas" },
];

export default function Admin() {
  const [ok, setOk] = useState<boolean | null>(null);
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<Tab>("productos");
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [revs, setRevs] = useState<Revendedor[]>([]);
  const [aviso, setAviso] = useState({ t: "", tipo: "ok" as "ok" | "error" });

  const avisar = useCallback((t: string, tipo: "ok" | "error" = "ok") => {
    setAviso({ t, tipo });
    setTimeout(() => setAviso({ t: "", tipo: "ok" }), 2500);
  }, []);

  const cargar = useCallback(async () => {
    const [m, p, r] = await Promise.all([
      api<Marca[]>("/api/admin/marcas"),
      api<Producto[]>("/api/admin/productos"),
      api<Revendedor[]>("/api/admin/revendedores"),
    ]);
    setMarcas(m);
    setProductos(p);
    setRevs(r);
  }, []);

  useEffect(() => {
    api<{ ok: boolean }>("/api/admin/login").then((r) => setOk(r.ok)).catch(() => setOk(false));
  }, []);
  useEffect(() => {
    if (ok) cargar().catch((e) => avisar(e.message, "error"));
  }, [ok, cargar, avisar]);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      await api("/api/admin/login", { method: "POST", body: JSON.stringify({ password: pass }) });
      setOk(true);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  if (ok === null) return <div className="grid min-h-screen place-items-center text-neutral-400">Cargando…</div>;

  if (!ok)
    return (
      <main className="grid min-h-screen place-items-center bg-white p-6">
        <form onSubmit={entrar} className="w-full max-w-xs space-y-4 text-center">
          <LogoDM className="text-3xl" />
          <p className="text-neutral-500">Panel de administración</p>
          <input type="password" autoFocus className="campo text-center" placeholder="Contraseña" value={pass} onChange={(e) => setPass(e.target.value)} />
          {err && <p className="text-sm font-semibold text-red-600">{err}</p>}
          <button className="btn-dm w-full py-3">Entrar</button>
        </form>
      </main>
    );

  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <LogoDM className="text-xl" />
            <span className="rounded-full bg-tinta px-2 py-0.5 text-[11px] font-bold uppercase text-white">Admin</span>
          </div>
          <button
            className="text-sm font-semibold text-neutral-500"
            onClick={async () => {
              await api("/api/admin/login", { method: "DELETE" });
              setOk(false);
            }}
          >
            Salir
          </button>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-2">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`chip shrink-0 ${tab === t.id ? "chip-on" : "border-transparent bg-transparent"}`}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-5">
        {tab === "productos" && <Productos marcas={marcas} productos={productos} recargar={cargar} avisar={avisar} irImportar={() => setTab("importar")} />}
        {tab === "importar" && <Importar marcas={marcas} recargar={cargar} avisar={avisar} />}
        {tab === "png" && <FotosPng productos={productos} recargar={cargar} avisar={avisar} />}
        {tab === "marcas" && <Marcas marcas={marcas} productos={productos} recargar={cargar} avisar={avisar} />}
        {tab === "revendedores" && <Revendedores revs={revs} recargar={cargar} avisar={avisar} />}
        {tab === "stats" && <Stats revs={revs} productos={productos} marcas={marcas} />}
      </main>
      <Aviso texto={aviso.t} tipo={aviso.tipo} />
    </div>
  );
}

type Avisar = (t: string, tipo?: "ok" | "error") => void;

/* ───────────── Productos ───────────── */

const VACIO: Partial<Producto> = { nombre: "", sku: "", imagen_png: null, marca_id: null, imagen_url: null, beneficios: [], precio: null, precio_anterior: null, categoria: "", activo: true, orden: 0 };

function Productos({ marcas, productos, recargar, avisar, irImportar }: { marcas: Marca[]; productos: Producto[]; recargar: () => Promise<void>; avisar: Avisar; irImportar: () => void }) {
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState("");
  const [vis, setVis] = useState<"" | "on" | "off" | "sinpng">("");
  const [limite, setLimite] = useState(150);
  const [masivo, setMasivo] = useState(false);
  const [edit, setEdit] = useState<Partial<Producto> | null>(null);
  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const lista = productos.filter(
    (p) =>
      (!filtro || (filtro === "_sin" ? !p.marca_id : p.marca_id === filtro)) &&
      (!vis || (vis === "on" ? p.activo : vis === "off" ? !p.activo : !p.imagen_png)) &&
      (!q || norm(p.nombre).includes(norm(q)) || norm(p.sku || "").includes(norm(q))),
  );
  const hayFiltro = !!(q || filtro || vis);

  async function masiva(cambios: { activo?: boolean; marca_id?: string | null }, msg: string) {
    if (!lista.length) return;
    if (lista.length > 20 && !confirm(`¿Aplicar a ${lista.length} productos?`)) return;
    setMasivo(true);
    try {
      await api("/api/admin/productos", { method: "PATCH", body: JSON.stringify({ ids: lista.map((p) => p.id), ...cambios }) });
      await recargar();
      avisar(msg);
    } catch (e) {
      avisar((e as Error).message, "error");
    } finally {
      setMasivo(false);
    }
  }

  async function toggle(p: Producto) {
    await api("/api/admin/productos", { method: "PUT", body: JSON.stringify({ id: p.id, activo: !p.activo }) });
    await recargar();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input className="campo max-w-xs" placeholder="Buscar nombre o código…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="campo max-w-[200px]" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value="">Todas las marcas</option>
          {marcas.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre}
            </option>
          ))}
          <option value="_sin">Sin marca asignada</option>
        </select>
        <select className="campo max-w-[160px]" value={vis} onChange={(e) => setVis(e.target.value as "" | "on" | "off" | "sinpng")}>
          <option value="">Visibles y ocultos</option>
          <option value="on">Solo visibles</option>
          <option value="off">Solo ocultos</option>
          <option value="sinpng">Sin foto PNG</option>
        </select>
        <div className="ml-auto flex gap-2">
          <button className="btn-ghost" onClick={irImportar}>
            Importar de la web
          </button>
          <button className="btn-dm" onClick={() => setEdit({ ...VACIO })}>
            + Nuevo
          </button>
        </div>
      </div>
      <p className="text-sm text-neutral-500">
        {lista.length} de {productos.length} productos · {productos.filter((p) => p.activo).length} visibles para revendedores
      </p>

      {hayFiltro && lista.length > 0 && (
        <div className="tarjeta flex flex-wrap items-center gap-2 p-3">
          <span className="text-sm font-semibold text-neutral-600">Con los {lista.length} filtrados:</span>
          <button className="chip" disabled={masivo} onClick={() => masiva({ activo: true }, "Productos visibles")}>
            Mostrar todos
          </button>
          <button className="chip" disabled={masivo} onClick={() => masiva({ activo: false }, "Productos ocultos")}>
            Ocultar todos
          </button>
          <select
            className="campo max-w-[200px] py-1.5"
            value=""
            disabled={masivo}
            onChange={(e) => e.target.value && masiva({ marca_id: e.target.value === "_sin" ? null : e.target.value }, "Marca asignada")}
          >
            <option value="">Asignar marca…</option>
            {marcas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
            <option value="_sin">Quitar marca</option>
          </select>
          {masivo && <span className="text-sm text-neutral-400">Aplicando…</span>}
        </div>
      )}

      {productos.length === 0 ? (
        <div className="tarjeta p-10 text-center">
          <p className="font-semibold">Todavía no hay productos.</p>
          <p className="mt-1 text-neutral-500">Importalos desde dentalmedrano.com.ar en un click.</p>
          <button className="btn-dm mt-4" onClick={irImportar}>
            Importar productos
          </button>
        </div>
      ) : (
        <div className="grid gap-2">
          {lista.slice(0, limite).map((p) => (
            <div key={p.id} className={`tarjeta flex items-center gap-3 p-2.5 ${p.activo ? "" : "opacity-55"}`}>
              <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-neutral-50">
                {(p.imagen_png || p.imagen_url) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imagen_png || p.imagen_url || ""} alt="" loading="lazy" className="h-full w-full object-contain" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{p.nombre}</p>
                <p className="text-sm text-neutral-500">
                  {p.sku && <span className="font-mono">{p.sku} · </span>}
                  {marcas.find((m) => m.id === p.marca_id)?.nombre || <span className="text-amber-600">Sin marca</span>}
                  {p.precio ? ` · $${p.precio.toLocaleString("es-AR")}` : ""}
                  {p.imagen_png ? <span className="ml-1.5 rounded bg-emerald-50 px-1.5 text-xs font-bold text-emerald-700">PNG</span> : <span className="ml-1.5 rounded bg-amber-50 px-1.5 text-xs font-bold text-amber-700">sin PNG</span>}
                </p>
              </div>
              <button onClick={() => toggle(p)} className={`chip hidden text-xs sm:block ${p.activo ? "" : "border-amber-300 bg-amber-50 text-amber-700"}`}>
                {p.activo ? "Visible" : "Oculto"}
              </button>
              <button className="btn-ghost px-3 py-2" onClick={() => setEdit(p)}>
                Editar
              </button>
            </div>
          ))}
          {lista.length > limite && (
            <button className="btn-ghost" onClick={() => setLimite((l) => l + 300)}>
              Ver más ({lista.length - limite} restantes)
            </button>
          )}
        </div>
      )}

      <Modal abierto={!!edit} onCerrar={() => setEdit(null)} titulo={edit?.id ? "Editar producto" : "Nuevo producto"}>
        {edit && (
          <FormProducto
            inicial={edit}
            marcas={marcas}
            onListo={async (msg) => {
              setEdit(null);
              await recargar();
              avisar(msg);
            }}
            avisar={avisar}
          />
        )}
      </Modal>
    </div>
  );
}

function FormProducto({ inicial, marcas, onListo, avisar }: { inicial: Partial<Producto>; marcas: Marca[]; onListo: (m: string) => void; avisar: Avisar }) {
  const [p, setP] = useState({
    ...inicial,
    beneficiosTxt: (inicial.beneficios || []).join("\n"),
    precioTxt: inicial.precio != null ? String(inicial.precio) : "",
    anteriorTxt: inicial.precio_anterior != null ? String(inicial.precio_anterior) : "",
  });
  const [subiendo, setSubiendo] = useState(false);
  const set = (k: string, v: unknown) => setP((s) => ({ ...s, [k]: v }));

  async function subir(f: File | undefined, campo: "imagen_url" | "imagen_png") {
    if (!f) return;
    setSubiendo(true);
    try {
      set(campo, await subirImagen(f, campo === "imagen_png" ? "png" : "productos"));
    } catch (er) {
      avisar((er as Error).message, "error");
    } finally {
      setSubiendo(false);
    }
  }

  async function guardar() {
    const body = {
      id: p.id,
      nombre: p.nombre,
      sku: p.sku || null,
      imagen_png: p.imagen_png || null,
      marca_id: p.marca_id || null,
      imagen_url: p.imagen_url || null,
      beneficios: p.beneficiosTxt.split("\n").map((s) => s.trim()).filter(Boolean),
      precio: p.precioTxt,
      precio_anterior: p.anteriorTxt,
      categoria: p.categoria || null,
      descripcion: p.descripcion || null,
      url_web: p.url_web || null,
      activo: p.activo ?? true,
      orden: p.orden ?? 0,
    };
    try {
      await api("/api/admin/productos", { method: p.id ? "PUT" : "POST", body: JSON.stringify(body) });
      onListo("Producto guardado");
    } catch (e) {
      avisar((e as Error).message, "error");
    }
  }

  async function borrar() {
    if (!p.id || !confirm("¿Borrar este producto? Esta acción no se puede deshacer.")) return;
    await api(`/api/admin/productos?id=${p.id}`, { method: "DELETE" });
    onListo("Producto borrado");
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            ["imagen_png", "Foto PNG sin fondo", "La que se usa en los posteos"],
            ["imagen_url", "Foto de la web", "Se usa si no hay PNG"],
          ] as const
        ).map(([campo, titulo, sub]) => (
          <div key={campo} className="space-y-2">
            <div>
              <p className="text-sm font-bold">{titulo}</p>
              <p className="text-xs text-neutral-400">{sub}</p>
            </div>
            <div className="grid aspect-square place-items-center overflow-hidden rounded-2xl border border-neutral-200 bg-[repeating-conic-gradient(#f2f2f2_0_25%,#fff_0_50%)] bg-[length:16px_16px]">
              {p[campo] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p[campo] || ""} alt="" className="h-full w-full object-contain p-2" />
              ) : (
                <span className="text-xs text-neutral-400">Sin imagen</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="btn-ghost cursor-pointer px-3 py-1.5 text-xs">
                {subiendo ? "Subiendo…" : p[campo] ? "Cambiar" : "Subir"}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => subir(e.target.files?.[0], campo)} />
              </label>
              {p[campo] && (
                <button type="button" className="text-xs text-neutral-500 underline" onClick={() => set(campo, null)}>
                  Quitar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
        <Campo label="Nombre">
          <input className="campo" value={p.nombre || ""} onChange={(e) => set("nombre", e.target.value)} />
        </Campo>
        <Campo label="Código">
          <input className="campo font-mono" value={p.sku || ""} onChange={(e) => set("sku", e.target.value)} />
        </Campo>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Marca">
          <select className="campo" value={p.marca_id || ""} onChange={(e) => set("marca_id", e.target.value)}>
            <option value="">Sin marca</option>
            {marcas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Categoría">
          <input className="campo" value={p.categoria || ""} onChange={(e) => set("categoria", e.target.value)} />
        </Campo>
        <Campo label="Precio sugerido" ayuda="Se precarga en el post (el revendedor lo puede cambiar)">
          <input className="campo" inputMode="decimal" value={p.precioTxt} onChange={(e) => set("precioTxt", e.target.value)} />
        </Campo>
        <Campo label="Precio anterior">
          <input className="campo" inputMode="decimal" value={p.anteriorTxt} onChange={(e) => set("anteriorTxt", e.target.value)} />
        </Campo>
      </div>
      <Campo label="Beneficios (uno por línea)" ayuda="Se muestran los primeros 3 por defecto">
        <textarea rows={4} className="campo" value={p.beneficiosTxt} onChange={(e) => set("beneficiosTxt", e.target.value)} />
      </Campo>
      <Toggle on={p.activo ?? true} onChange={(v) => set("activo", v)} label="Visible para revendedores" />
      <div className="flex gap-2 pt-2">
        {p.id && (
          <button className="btn-ghost text-red-600" onClick={borrar}>
            Borrar
          </button>
        )}
        <button className="btn-dm flex-1 py-3" disabled={!p.nombre?.trim() || subiendo} onClick={guardar}>
          Guardar
        </button>
      </div>
    </div>
  );
}

/* ───────────── Importar ───────────── */

type ItemWc = {
  wc_id: number;
  nombre: string;
  url: string;
  imagen: string | null;
  descripcion: string;
  beneficios: string[];
  precio: number | null;
  precio_anterior: number | null;
  categoria: string | null;
  marca: string | null;
  importado: boolean;
};

function ImportarCsv({ recargar, avisar }: { recargar: () => Promise<void>; avisar: Avisar }) {
  const [filas, setFilas] = useState<FilaProducto[]>([]);
  const [archivo, setArchivo] = useState("");
  const [ocultos, setOcultos] = useState(true);
  const [actualizar, setActualizar] = useState(false);
  const [fotos, setFotos] = useState(true);
  const [noPublicados, setNoPublicados] = useState(false);
  const [estado, setEstado] = useState<{ corriendo: boolean; hechos: number; nuevos: number; actualizados: number; salteados: number; errores: number } | null>(null);
  const parar = useRef(false);

  async function leer(f?: File) {
    if (!f) return;
    setEstado(null);
    const buf = await f.arrayBuffer();
    // WooCommerce exporta en UTF-8; Excel a veces guarda en Windows-1252
    let texto = new TextDecoder("utf-8").decode(buf);
    if (texto.includes("\uFFFD")) texto = new TextDecoder("windows-1252").decode(buf);
    const prods = filasAProductos(parseCsv(texto));
    setFilas(prods);
    setArchivo(f.name);
    if (!prods.length) avisar("No encontré productos en ese archivo", "error");
  }

  const aImportar = filas.filter((p) => noPublicados || p.publicado);

  async function correr() {
    parar.current = false;
    const e = { corriendo: true, hechos: 0, nuevos: 0, actualizados: 0, salteados: 0, errores: 0 };
    setEstado({ ...e });
    const tam = fotos ? 15 : 50;
    for (let i = 0; i < aImportar.length; i += tam) {
      if (parar.current) break;
      const lote = aImportar.slice(i, i + tam);
      try {
        const r = await api<{ nuevos: number; actualizados: number; salteados: number; errores: number }>("/api/admin/importar-csv", {
          method: "POST",
          body: JSON.stringify({ items: lote, ocultos, actualizar, fotos }),
        });
        e.nuevos += r.nuevos;
        e.actualizados += r.actualizados;
        e.salteados += r.salteados;
        e.errores += r.errores;
      } catch {
        e.errores += lote.length;
      }
      e.hechos += lote.length;
      setEstado({ ...e });
    }
    e.corriendo = false;
    setEstado({ ...e });
    await recargar();
    avisar(`Listo: ${e.nuevos} nuevos, ${e.actualizados} actualizados`);
  }

  const pct = estado && aImportar.length ? Math.round((estado.hechos / aImportar.length) * 100) : 0;
  const conCodigo = filas.filter((p) => p.sku).length;

  return (
    <div className="tarjeta space-y-3 border-dm/30 bg-dm/[0.03] p-4">
      <div>
        <h3 className="font-extrabold">Importar desde CSV de WooCommerce (recomendado)</h3>
        <p className="text-[15px] text-neutral-600">
          En el WordPress: <strong>Productos → Todos los productos → Exportar</strong> → dejá todo marcado → <strong>Generar CSV</strong>. Subí ese archivo acá. Trae nombre, código, precio, categoría, marca y descripción.
        </p>
      </div>
      <label className="btn-ghost w-full cursor-pointer py-3">
        {archivo ? `📄 ${archivo} · cambiar` : "Elegir archivo CSV"}
        <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => leer(e.target.files?.[0])} />
      </label>

      {filas.length > 0 && (
        <>
          <p className="text-sm text-neutral-600">
            <strong>{filas.length}</strong> productos en el archivo · {conCodigo} con código · {filas.filter((p) => !p.publicado).length} no publicados
          </p>
          <div className="divide-y divide-neutral-100 rounded-xl bg-white px-3">
            <Toggle on={ocultos} onChange={setOcultos} label="Importar como ocultos" sub="Después mostrás por marca los que quieras que vean los revendedores" />
            <Toggle on={actualizar} onChange={setActualizar} label="Actualizar los que ya están" sub="Pisa nombre, precio y beneficios con los del CSV (no toca tus PNG)" />
            <Toggle on={fotos} onChange={setFotos} label="Intentar bajar la foto de la web" sub="Más lento. Apagalo si vas a cargar todos los PNG" />
            <Toggle on={noPublicados} onChange={setNoPublicados} label="Incluir productos no publicados" />
          </div>
          {estado && (
            <div className="space-y-1.5">
              <div className="h-3 overflow-hidden rounded-full bg-neutral-200">
                <div className="h-full rounded-full bg-dm transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-sm text-neutral-600">
                {estado.hechos}/{aImportar.length} · {estado.nuevos} nuevos · {estado.actualizados} actualizados · {estado.salteados} ya estaban
                {estado.errores ? ` · ${estado.errores} con error` : ""}
                {!estado.corriendo && " · terminado"}
              </p>
            </div>
          )}
          {estado?.corriendo ? (
            <button className="btn-ghost w-full" onClick={() => (parar.current = true)}>
              Pausar
            </button>
          ) : (
            <button className="btn-dm w-full py-3" disabled={!aImportar.length} onClick={correr}>
              Importar {aImportar.length} productos
            </button>
          )}
        </>
      )}
    </div>
  );
}

function ImportarTodo({ recargar, avisar }: { recargar: () => Promise<void>; avisar: Avisar }) {
  const [ocultos, setOcultos] = useState(true);
  const [saltar, setSaltar] = useState(true);
  const [estado, setEstado] = useState<{ corriendo: boolean; hechos: number; total: number; nuevos: number; errores: number; pagina: number; paginas: number } | null>(null);
  const parar = useRef(false);
  const [errorTodo, setErrorTodo] = useState("");

  async function correr() {
    setErrorTodo("");
    if (!confirm("Se van a recorrer todos los productos de dentalmedrano.com.ar. Puede tardar varios minutos: dejá esta pestaña abierta. ¿Arrancamos?")) return;
    parar.current = false;
    const e = { corriendo: true, hechos: 0, total: 0, nuevos: 0, errores: 0, pagina: 0, paginas: 1 };
    setEstado({ ...e });
    try {
      for (let page = 1; page <= e.paginas; page++) {
        if (parar.current) break;
        let r: { items: ItemWc[]; total: number; paginas: number } | null = null;
        for (let intento = 0; intento < 3 && !r; intento++) {
          try {
            r = await api(`/api/admin/importar?q=&page=${page}`);
          } catch {
            await new Promise((ok) => setTimeout(ok, 2000));
          }
        }
        if (!r) throw new Error(`No se pudo leer la página ${page} de la tienda`);
        e.paginas = r.paginas;
        e.total = r.total;
        e.pagina = page;
        for (let i = 0; i < r.items.length; i += 8) {
          if (parar.current) break;
          const lote = r.items.slice(i, i + 8);
          try {
            const res = await api<{ resultados: { ok: boolean; salteado?: boolean }[] }>("/api/admin/importar", {
              method: "POST",
              body: JSON.stringify({ items: lote, ocultos, saltarExistentes: saltar }),
            });
            e.nuevos += res.resultados.filter((x) => x.ok && !x.salteado).length;
            e.errores += res.resultados.filter((x) => !x.ok).length;
          } catch {
            e.errores += lote.length;
          }
          e.hechos += lote.length;
          setEstado({ ...e });
        }
      }
      await recargar();
      avisar(parar.current ? `Importación pausada: ${e.nuevos} nuevos` : `¡Listo! ${e.nuevos} productos importados`);
    } catch (er) {
      setErrorTodo((er as Error).message);
      avisar((er as Error).message, "error");
    } finally {
      e.corriendo = false;
      setEstado({ ...e });
    }
  }

  const pct = estado && estado.total ? Math.round((estado.hechos / estado.total) * 100) : 0;

  return (
    <div className="tarjeta space-y-3 p-4">
      <div>
        <h3 className="font-extrabold">Importar desde la web (automático)</h3>
        <p className="text-[15px] text-neutral-600">Lee los productos directo de dentalmedrano.com.ar. Si da error, usá el CSV de arriba.</p>
      </div>
      {errorTodo && <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{errorTodo}</p>}
      <div className="divide-y divide-neutral-100 rounded-xl bg-white px-3">
        <Toggle on={ocultos} onChange={setOcultos} label="Importar como ocultos" sub="Después mostrás por marca los que quieras que vean los revendedores" />
        <Toggle on={saltar} onChange={setSaltar} label="Saltar los que ya están" sub="Más rápido. Apagalo para actualizar precios y fotos" />
      </div>
      {estado && (
        <div className="space-y-1.5">
          <div className="h-3 overflow-hidden rounded-full bg-neutral-200">
            <div className="h-full rounded-full bg-dm transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-sm text-neutral-600">
            {estado.hechos} de {estado.total || "…"} revisados · {estado.nuevos} importados
            {estado.errores ? ` · ${estado.errores} con error` : ""}
            {estado.corriendo ? ` · página ${estado.pagina}/${estado.paginas}` : " · terminado"}
          </p>
        </div>
      )}
      {estado?.corriendo ? (
        <button className="btn-ghost w-full" onClick={() => (parar.current = true)}>
          Pausar
        </button>
      ) : (
        <button className="btn-dm w-full py-3" onClick={correr}>
          {estado ? "Volver a correr" : "Importar todo"}
        </button>
      )}
    </div>
  );
}

function Importar({ marcas, recargar, avisar }: { marcas: Marca[]; recargar: () => Promise<void>; avisar: Avisar }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<ItemWc[]>([]);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [pagina, setPagina] = useState(1);
  const [paginas, setPaginas] = useState(0);
  const [total, setTotal] = useState(0);
  const [buscando, setBuscando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [marcaForzada, setMarcaForzada] = useState("");
  const [error, setError] = useState("");

  async function buscar(page = 1) {
    setBuscando(true);
    setError("");
    try {
      const r = await api<{ items: ItemWc[]; total: number; paginas: number }>(`/api/admin/importar?q=${encodeURIComponent(q)}&page=${page}`);
      setItems((prev) => (page === 1 ? r.items : [...prev, ...r.items]));
      setPagina(page);
      setPaginas(r.paginas);
      setTotal(r.total);
      if (page === 1) setSel(new Set());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBuscando(false);
    }
  }

  async function importar() {
    const elegidos = items.filter((i) => sel.has(i.wc_id));
    if (!elegidos.length) return;
    setImportando(true);
    let ok = 0;
    try {
      for (let i = 0; i < elegidos.length; i += 10) {
        const lote = elegidos.slice(i, i + 10);
        const r = await api<{ resultados: { ok: boolean }[] }>("/api/admin/importar", {
          method: "POST",
          body: JSON.stringify({ items: lote, marca_id: marcaForzada || undefined }),
        });
        ok += r.resultados.filter((x) => x.ok).length;
      }
      setItems((prev) => prev.map((i) => (sel.has(i.wc_id) ? { ...i, importado: true } : i)));
      setSel(new Set());
      await recargar();
      avisar(`${ok} producto${ok === 1 ? "" : "s"} importado${ok === 1 ? "" : "s"}`);
    } catch (e) {
      avisar((e as Error).message, "error");
    } finally {
      setImportando(false);
    }
  }

  const todos = items.length > 0 && items.every((i) => sel.has(i.wc_id));

  return (
    <div className="space-y-4">
      <ImportarCsv recargar={recargar} avisar={avisar} />
      <ImportarTodo recargar={recargar} avisar={avisar} />
      <div className="tarjeta space-y-3 p-4">
        <h3 className="font-extrabold">Importar productos puntuales</h3>
        <p className="text-[15px] text-neutral-600">
          Buscá por nombre, marca o pegá el link de un producto de <strong>dentalmedrano.com.ar</strong>. Se copian nombre, foto, beneficios y precio. Después podés editar todo.
        </p>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            buscar(1);
          }}
        >
          <input className="campo" placeholder="Ej: Coltene, composite, https://dentalmedrano.com.ar/producto/…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn-dark shrink-0" disabled={buscando}>
            {buscando ? "Buscando…" : "Buscar"}
          </button>
        </form>
        {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
      </div>

      {items.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button className="chip" onClick={() => setSel(todos ? new Set() : new Set(items.map((i) => i.wc_id)))}>
              {todos ? "Deseleccionar todos" : "Seleccionar todos"}
            </button>
            <span className="text-sm text-neutral-500">
              {total} resultados · {sel.size} seleccionados
            </span>
            <select className="campo ml-auto max-w-[230px]" value={marcaForzada} onChange={(e) => setMarcaForzada(e.target.value)}>
              <option value="">Detectar marca automáticamente</option>
              {marcas.map((m) => (
                <option key={m.id} value={m.id}>
                  Asignar a {m.nombre}
                </option>
              ))}
            </select>
            <button className="btn-dm" disabled={!sel.size || importando} onClick={importar}>
              {importando ? "Importando…" : `Importar ${sel.size || ""}`}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {items.map((i) => {
              const on = sel.has(i.wc_id);
              return (
                <button
                  key={i.wc_id}
                  onClick={() =>
                    setSel((s) => {
                      const n = new Set(s);
                      if (n.has(i.wc_id)) n.delete(i.wc_id);
                      else n.add(i.wc_id);
                      return n;
                    })
                  }
                  className={`tarjeta relative overflow-hidden border-2 text-left transition ${on ? "border-dm" : "border-transparent"}`}
                >
                  <span className={`absolute left-2 top-2 z-10 grid h-6 w-6 place-items-center rounded-md border-2 text-xs font-bold ${on ? "border-dm bg-dm text-white" : "border-neutral-300 bg-white"}`}>
                    {on ? "✓" : ""}
                  </span>
                  {i.importado && <span className="absolute right-2 top-2 z-10 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">YA ESTÁ</span>}
                  <span className="block aspect-square bg-white p-2">
                    {i.imagen && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={i.imagen} alt="" loading="lazy" className="h-full w-full object-contain" />
                    )}
                  </span>
                  <span className="block border-t border-neutral-100 p-2">
                    <span className="line-clamp-2 text-sm font-semibold leading-tight">{i.nombre}</span>
                    <span className="text-xs text-neutral-500">{i.precio ? `$${i.precio.toLocaleString("es-AR")}` : "Sin precio"}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {pagina < paginas && (
            <button className="btn-ghost w-full" disabled={buscando} onClick={() => buscar(pagina + 1)}>
              {buscando ? "Cargando…" : "Cargar más resultados"}
            </button>
          )}
          <p className="text-xs text-neutral-400">Si un producto ya estaba importado, se actualiza con los datos de la web.</p>
        </>
      )}
    </div>
  );
}

/* ───────────── Fotos PNG (carga masiva) ───────────── */

const clave = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

type Archivo = { file: File; preview: string; producto: Producto | null; estado: "pendiente" | "ok" | "error" };

function FotosPng({ productos, recargar, avisar }: { productos: Producto[]; recargar: () => Promise<void>; avisar: Avisar }) {
  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [reemplazar, setReemplazar] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);

  const indice = useMemo(() => {
    const porSku = new Map<string, Producto>();
    const porNombre = new Map<string, Producto>();
    productos.forEach((p) => {
      if (p.sku && !porSku.has(clave(p.sku))) porSku.set(clave(p.sku), p);
      if (!porNombre.has(clave(p.nombre))) porNombre.set(clave(p.nombre), p);
    });
    return { porSku, porNombre };
  }, [productos]);

  function buscar(nombreArchivo: string) {
    const base = nombreArchivo.replace(/\.[^.]+$/, "");
    const variantes = [base, base.replace(/\s*\(\d+\)$/, ""), base.replace(/[_\s-]\d{1,2}$/, ""), base.split(/[\s_]/)[0]];
    for (const v of variantes) {
      const k = clave(v);
      if (k && indice.porSku.has(k)) return indice.porSku.get(k)!;
    }
    return indice.porNombre.get(clave(base)) || null;
  }

  function agregar(lista: FileList | File[]) {
    const nuevos = [...lista]
      .filter((f) => /image\/(png|jpeg|webp)/.test(f.type))
      .map((file) => ({ file, preview: URL.createObjectURL(file), producto: buscar(file.name), estado: "pendiente" as const }));
    setArchivos((a) => [...a, ...nuevos]);
  }

  const aSubir = archivos.filter((a) => a.producto && a.estado !== "ok" && (reemplazar || !a.producto.imagen_png));
  const sinMatch = archivos.filter((a) => !a.producto);
  const faltantes = productos.filter((p) => p.activo && !p.imagen_png);

  async function subirTodo() {
    setSubiendo(true);
    const cola = [...aSubir];
    let ok = 0;
    const trabajar = async () => {
      while (cola.length) {
        const a = cola.shift()!;
        try {
          const url = await subirImagen(a.file, "png");
          await api("/api/admin/productos", { method: "PUT", body: JSON.stringify({ id: a.producto!.id, imagen_png: url }) });
          a.estado = "ok";
          ok++;
        } catch {
          a.estado = "error";
        }
        setArchivos((x) => [...x]);
      }
    };
    await Promise.all([trabajar(), trabajar(), trabajar()]);
    await recargar();
    setSubiendo(false);
    avisar(`${ok} fotos cargadas`);
  }

  async function copiarFaltantes() {
    const txt = faltantes.map((p) => `${p.sku || "(sin código)"}\t${p.nombre}`).join("\n");
    try {
      await navigator.clipboard.writeText(txt);
      avisar(`${faltantes.length} productos copiados (pegalos en Excel)`);
    } catch {
      avisar("No se pudo copiar", "error");
    }
  }

  return (
    <div className="space-y-4">
      <div className="tarjeta space-y-2 p-4">
        <h3 className="font-extrabold">Carga masiva de fotos PNG</h3>
        <p className="text-[15px] text-neutral-600">
          Nombrá cada archivo con el <strong>código del producto</strong> (ej: <span className="font-mono">6510.png</span>) y arrastralos todos juntos. Se asignan solos. También funciona si el archivo tiene el nombre exacto del producto.
        </p>
        <p className="text-sm text-neutral-500">
          Productos visibles sin PNG: <strong>{faltantes.length}</strong>
          {faltantes.length > 0 && (
            <button className="ml-2 font-bold text-dm" onClick={copiarFaltantes}>
              Copiar lista de códigos faltantes
            </button>
          )}
        </p>
      </div>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastrando(false);
          agregar(e.dataTransfer.files);
        }}
        className={`grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed p-10 text-center transition ${arrastrando ? "border-dm bg-dm/5" : "border-neutral-300 bg-white"}`}
      >
        <div>
          <p className="font-display text-lg font-extrabold">Arrastrá las fotos acá</p>
          <p className="text-neutral-500">o tocá para elegirlas (podés seleccionar cientos juntas)</p>
        </div>
        <input type="file" multiple accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => e.target.files && agregar(e.target.files)} />
      </label>

      {archivos.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-neutral-600">
              {archivos.length} archivos · <strong className="text-emerald-700">{archivos.length - sinMatch.length} encontrados</strong>
              {sinMatch.length > 0 && <strong className="text-amber-700"> · {sinMatch.length} sin coincidencia</strong>}
            </span>
            <div className="w-64 rounded-xl bg-white px-3">
              <Toggle on={reemplazar} onChange={setReemplazar} label="Reemplazar PNG existentes" />
            </div>
            <button className="chip" onClick={() => setArchivos([])} disabled={subiendo}>
              Limpiar
            </button>
            <button className="btn-dm ml-auto" disabled={!aSubir.length || subiendo} onClick={subirTodo}>
              {subiendo ? `Subiendo… ${archivos.filter((a) => a.estado === "ok").length}/${aSubir.length + archivos.filter((a) => a.estado === "ok").length}` : `Subir ${aSubir.length} fotos`}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {archivos.map((a, i) => (
              <div key={i} className={`tarjeta overflow-hidden border-2 ${a.estado === "ok" ? "border-emerald-500" : a.estado === "error" ? "border-red-500" : a.producto ? "border-transparent" : "border-amber-400"}`}>
                <div className="aspect-square bg-[repeating-conic-gradient(#f2f2f2_0_25%,#fff_0_50%)] bg-[length:14px_14px] p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.preview} alt="" className="h-full w-full object-contain" />
                </div>
                <div className="border-t border-neutral-100 p-2">
                  <p className="truncate font-mono text-[11px] text-neutral-400">{a.file.name}</p>
                  {a.producto ? (
                    <p className="line-clamp-2 text-xs font-semibold leading-tight">{a.producto.nombre}</p>
                  ) : (
                    <p className="text-xs font-semibold text-amber-700">Sin coincidencia</p>
                  )}
                  {a.estado === "ok" && <p className="text-xs font-bold text-emerald-700">✓ Cargada</p>}
                  {a.estado === "error" && <p className="text-xs font-bold text-red-600">Error, reintentá</p>}
                  {a.producto?.imagen_png && a.estado === "pendiente" && <p className="text-[11px] text-neutral-400">Ya tenía PNG</p>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ───────────── Marcas ───────────── */

function Marcas({ marcas, productos, recargar, avisar }: { marcas: Marca[]; productos: Producto[]; recargar: () => Promise<void>; avisar: Avisar }) {
  const [nueva, setNueva] = useState("");
  async function guardar(id: string, cambios: Partial<Marca>) {
    try {
      await api("/api/admin/marcas", { method: "PUT", body: JSON.stringify({ id, ...cambios }) });
      await recargar();
    } catch (e) {
      avisar((e as Error).message, "error");
    }
  }
  async function crear() {
    if (!nueva.trim()) return;
    await api("/api/admin/marcas", { method: "POST", body: JSON.stringify({ nombre: nueva, orden: marcas.length + 1 }) });
    setNueva("");
    await recargar();
    avisar("Marca creada");
  }
  async function borrar(m: Marca) {
    const n = productos.filter((p) => p.marca_id === m.id).length;
    if (!confirm(`¿Borrar ${m.nombre}?${n ? ` Sus ${n} productos quedan sin marca.` : ""}`)) return;
    await api(`/api/admin/marcas?id=${m.id}`, { method: "DELETE" });
    await recargar();
  }

  return (
    <div className="space-y-4">
      <p className="text-[15px] text-neutral-600">
        Subí el logo de cada marca (ideal PNG sin fondo) y elegí su color: es el que usan los posteos por defecto.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {marcas.map((m) => (
          <FilaMarca key={m.id} m={m} n={productos.filter((p) => p.marca_id === m.id).length} guardar={guardar} borrar={borrar} avisar={avisar} />
        ))}
      </div>
      <div className="tarjeta flex gap-2 p-3">
        <input className="campo" placeholder="Nueva marca" value={nueva} onChange={(e) => setNueva(e.target.value)} />
        <button className="btn-dm shrink-0" onClick={crear}>
          Agregar
        </button>
      </div>
    </div>
  );
}

function FilaMarca({ m, n, guardar, borrar, avisar }: { m: Marca; n: number; guardar: (id: string, c: Partial<Marca>) => Promise<void>; borrar: (m: Marca) => void; avisar: Avisar }) {
  const [nombre, setNombre] = useState(m.nombre);
  const [subiendo, setSubiendo] = useState(false);
  return (
    <div className={`tarjeta space-y-3 p-4 ${m.activo ? "" : "opacity-60"}`}>
      <div className="flex items-center gap-3">
        <label className="grid h-20 w-32 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-xl border border-dashed border-neutral-300 bg-white">
          {subiendo ? (
            <span className="text-xs text-neutral-400">Subiendo…</span>
          ) : m.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.logo_url} alt="" className="max-h-16 max-w-28 object-contain" />
          ) : (
            <span className="text-xs font-semibold text-dm">Subir logo</span>
          )}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setSubiendo(true);
              try {
                await guardar(m.id, { logo_url: await subirImagen(f, "marcas") });
                avisar("Logo actualizado");
              } catch (er) {
                avisar((er as Error).message, "error");
              } finally {
                setSubiendo(false);
              }
            }}
          />
        </label>
        <div className="min-w-0 flex-1 space-y-2">
          <input className="campo font-bold" value={nombre} onChange={(e) => setNombre(e.target.value)} onBlur={() => nombre !== m.nombre && guardar(m.id, { nombre })} />
          <div className="flex items-center gap-2">
            <label className="relative h-9 w-9 shrink-0 cursor-pointer overflow-hidden rounded-full border-2 border-white shadow" style={{ background: m.color }}>
              <input type="color" className="absolute inset-0 opacity-0" defaultValue={m.color} onBlur={(e) => e.target.value !== m.color && guardar(m.id, { color: e.target.value })} />
            </label>
            <span className="font-mono text-xs text-neutral-500">{m.color}</span>
            <span className="ml-auto text-xs text-neutral-500">{n} productos</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <button className="chip text-xs" onClick={() => guardar(m.id, { activo: !m.activo })}>
          {m.activo ? "Visible" : "Oculta"}
        </button>
        {m.logo_url && (
          <button className="chip text-xs" onClick={() => guardar(m.id, { logo_url: null })}>
            Quitar logo
          </button>
        )}
        <button className="ml-auto text-xs font-semibold text-red-600" onClick={() => borrar(m)}>
          Borrar
        </button>
      </div>
    </div>
  );
}

/* ───────────── Revendedores ───────────── */

function Revendedores({ revs, recargar, avisar }: { revs: Revendedor[]; recargar: () => Promise<void>; avisar: Avisar }) {
  const [nombre, setNombre] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [q, setQ] = useState("");
  const origen = typeof window !== "undefined" ? window.location.origin : "";

  async function crear() {
    if (!nombre.trim()) return;
    try {
      const r = await api<Revendedor>("/api/admin/revendedores", { method: "POST", body: JSON.stringify({ nombre, whatsapp }) });
      setNombre("");
      setWhatsapp("");
      await recargar();
      await copiar(r);
    } catch (e) {
      avisar((e as Error).message, "error");
    }
  }
  async function copiar(r: Revendedor) {
    const msg = `¡Hola! Te comparto tu generador de posteos de Dental Medrano 🦷\n\nEntrá acá, cargá tu logo y tus datos, y creá publicaciones de nuestros productos listas para tus redes:\n${origen}/${r.slug}`;
    try {
      await navigator.clipboard.writeText(msg);
      avisar("Mensaje con el link copiado");
    } catch {
      prompt("Copiá el link:", `${origen}/${r.slug}`);
    }
  }
  async function toggle(r: Revendedor) {
    await api("/api/admin/revendedores", { method: "PUT", body: JSON.stringify({ id: r.id, activo: !r.activo }) });
    await recargar();
  }
  async function borrar(r: Revendedor) {
    if (!confirm(`¿Borrar a ${r.nombre}? Su link deja de funcionar y se borran sus estadísticas.`)) return;
    await api(`/api/admin/revendedores?id=${r.id}`, { method: "DELETE" });
    await recargar();
  }

  const lista = revs.filter((r) => !q || r.nombre.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="tarjeta space-y-3 p-4">
        <h3 className="font-extrabold">Nuevo revendedor</h3>
        <div className="grid gap-2 sm:grid-cols-[1fr_200px_auto]">
          <input className="campo" placeholder="Nombre de la casa dental" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <input className="campo" placeholder="WhatsApp (opcional)" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
          <button className="btn-dm" onClick={crear} disabled={!nombre.trim()}>
            Crear y copiar link
          </button>
        </div>
        <p className="text-xs text-neutral-400">Se genera un link único. El revendedor carga su logo y datos la primera vez que entra.</p>
      </div>

      <input className="campo max-w-xs" placeholder="Buscar revendedor…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="grid gap-2">
        {lista.map((r) => (
          <div key={r.id} className={`tarjeta flex flex-wrap items-center gap-3 p-3 ${r.activo ? "" : "opacity-55"}`}>
            <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-neutral-50">
              {r.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.logo_url} alt="" className="h-full w-full object-contain p-1" />
              ) : (
                <span className="text-lg font-bold text-neutral-300">{r.nombre[0]}</span>
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{r.nombre}</p>
              <p className="truncate text-xs text-neutral-500">
                /{r.slug}
                {r.whatsapp ? ` · ${r.whatsapp}` : ""}
                {!r.logo_url && !r.whatsapp ? " · todavía no cargó sus datos" : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost px-3 py-2 text-xs" onClick={() => copiar(r)}>
                Copiar link
              </button>
              <a className="btn-ghost px-3 py-2 text-xs" href={`/${r.slug}`} target="_blank" rel="noreferrer">
                Abrir
              </a>
              <button className="chip text-xs" onClick={() => toggle(r)}>
                {r.activo ? "Activo" : "Inactivo"}
              </button>
              <button className="px-2 text-xs font-semibold text-red-600" onClick={() => borrar(r)}>
                Borrar
              </button>
            </div>
          </div>
        ))}
        {!revs.length && <p className="py-8 text-center text-neutral-500">Todavía no hay revendedores.</p>}
      </div>
    </div>
  );
}

/* ───────────── Estadísticas ───────────── */

type Descarga = { id: string; created_at: string; plantilla: string; formato: string; revendedor_id: string; producto_id: string | null };

function Stats({ revs, productos, marcas }: { revs: Revendedor[]; productos: Producto[]; marcas: Marca[] }) {
  const [d, setD] = useState<Descarga[] | null>(null);
  const [dias, setDias] = useState(30);
  useEffect(() => {
    api<Descarga[]>("/api/admin/stats").then(setD).catch(() => setD([]));
  }, []);

  const filtradas = useMemo(() => {
    if (!d) return [];
    const desde = Date.now() - dias * 864e5;
    return d.filter((x) => new Date(x.created_at).getTime() >= desde);
  }, [d, dias]);

  const contar = (key: (x: Descarga) => string | null) => {
    const m = new Map<string, number>();
    filtradas.forEach((x) => {
      const k = key(x);
      if (k) m.set(k, (m.get(k) || 0) + 1);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };

  if (!d) return <p className="text-neutral-400">Cargando…</p>;

  const porRev = contar((x) => x.revendedor_id);
  const porProd = contar((x) => x.producto_id);
  const porMarca = contar((x) => productos.find((p) => p.id === x.producto_id)?.marca_id || null);
  const activos = new Set(filtradas.map((x) => x.revendedor_id)).size;
  const nombreRev = (id: string) => revs.find((r) => r.id === id)?.nombre || "—";
  const nombreProd = (id: string) => productos.find((p) => p.id === id)?.nombre || "Producto borrado";
  const nombreMarca = (id: string) => marcas.find((m) => m.id === id)?.nombre || "—";

  const Ranking = ({ titulo, filas, nombre }: { titulo: string; filas: [string, number][]; nombre: (id: string) => string }) => {
    const max = filas[0]?.[1] || 1;
    return (
      <div className="tarjeta p-4">
        <h3 className="mb-3 font-extrabold">{titulo}</h3>
        {!filas.length && <p className="text-sm text-neutral-400">Sin datos</p>}
        <div className="space-y-2">
          {filas.slice(0, 10).map(([id, n]) => (
            <div key={id}>
              <div className="flex justify-between gap-2 text-sm">
                <span className="truncate">{nombre(id)}</span>
                <span className="font-bold">{n}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-neutral-100">
                <div className="h-full rounded-full bg-dm" style={{ width: `${(n / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[7, 30, 90, 365].map((n) => (
          <button key={n} onClick={() => setDias(n)} className={`chip ${dias === n ? "chip-on" : ""}`}>
            {n === 365 ? "1 año" : `${n} días`}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { l: "Posteos descargados", v: filtradas.length },
          { l: "Revendedores activos", v: activos },
          { l: "Revendedores totales", v: revs.length },
          { l: "Sin usar todavía", v: revs.filter((r) => !d.some((x) => x.revendedor_id === r.id)).length },
        ].map((k) => (
          <div key={k.l} className="tarjeta p-4">
            <p className="text-3xl font-extrabold text-tinta">{k.v}</p>
            <p className="text-sm text-neutral-500">{k.l}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Ranking titulo="Revendedores que más usan" filas={porRev} nombre={nombreRev} />
        <Ranking titulo="Productos más publicados" filas={porProd} nombre={nombreProd} />
        <Ranking titulo="Marcas más publicadas" filas={porMarca} nombre={nombreMarca} />
      </div>
    </div>
  );
}
