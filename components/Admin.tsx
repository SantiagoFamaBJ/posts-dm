"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, subirImagen } from "@/lib/client";
import type { Marca, Producto, Revendedor } from "@/lib/types";
import { Aviso, Campo, LogoDM, Modal, Toggle } from "./ui";

type Tab = "productos" | "importar" | "marcas" | "revendedores" | "stats";
const TABS: { id: Tab; label: string }[] = [
  { id: "productos", label: "Productos" },
  { id: "importar", label: "Importar de la web" },
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

const VACIO: Partial<Producto> = { nombre: "", marca_id: null, imagen_url: null, beneficios: [], precio: null, precio_anterior: null, categoria: "", activo: true, orden: 0 };

function Productos({ marcas, productos, recargar, avisar, irImportar }: { marcas: Marca[]; productos: Producto[]; recargar: () => Promise<void>; avisar: Avisar; irImportar: () => void }) {
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState("");
  const [edit, setEdit] = useState<Partial<Producto> | null>(null);
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const lista = productos.filter(
    (p) => (!filtro || (filtro === "_sin" ? !p.marca_id : p.marca_id === filtro)) && (!q || norm(p.nombre).includes(norm(q))),
  );

  async function toggle(p: Producto) {
    await api("/api/admin/productos", { method: "PUT", body: JSON.stringify({ id: p.id, activo: !p.activo }) });
    await recargar();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input className="campo max-w-xs" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="campo max-w-[200px]" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value="">Todas las marcas</option>
          {marcas.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre}
            </option>
          ))}
          <option value="_sin">Sin marca asignada</option>
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
          {lista.map((p) => (
            <div key={p.id} className={`tarjeta flex items-center gap-3 p-2.5 ${p.activo ? "" : "opacity-55"}`}>
              <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-neutral-50">
                {p.imagen_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imagen_url} alt="" loading="lazy" className="h-full w-full object-contain" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{p.nombre}</p>
                <p className="text-sm text-neutral-500">
                  {marcas.find((m) => m.id === p.marca_id)?.nombre || <span className="text-amber-600">Sin marca</span>}
                  {p.precio ? ` · $${p.precio.toLocaleString("es-AR")}` : ""}
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

  async function guardar() {
    const body = {
      id: p.id,
      nombre: p.nombre,
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
      <div className="flex items-center gap-4">
        <div className="grid h-28 w-28 shrink-0 place-items-center overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          {p.imagen_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.imagen_url} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="text-xs text-neutral-400">Sin imagen</span>
          )}
        </div>
        <label className="btn-ghost cursor-pointer">
          {subiendo ? "Subiendo…" : "Cambiar imagen"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setSubiendo(true);
              try {
                set("imagen_url", await subirImagen(f, "productos"));
              } catch (er) {
                avisar((er as Error).message, "error");
              } finally {
                setSubiendo(false);
              }
            }}
          />
        </label>
      </div>
      <p className="-mt-2 text-xs text-neutral-400">Tip: un PNG sin fondo queda mucho mejor en las plantillas.</p>
      <Campo label="Nombre">
        <input className="campo" value={p.nombre || ""} onChange={(e) => set("nombre", e.target.value)} />
      </Campo>
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
      <div className="tarjeta space-y-3 p-4">
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
