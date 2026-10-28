"use client";

import { useState } from "react";
import { api, subirImagen } from "@/lib/client";
import type { Revendedor } from "@/lib/types";
import { Campo } from "./ui";

const COLORES = ["#f15922", "#16181d", "#0b4ea2", "#00843d", "#e30613", "#6d2077", "#0097a7", "#c9a227"];

export default function Perfil({ rev, onGuardado, primeraVez }: { rev: Revendedor; onGuardado: (r: Revendedor) => void; primeraVez?: boolean }) {
  const [f, setF] = useState({
    nombre: rev.nombre || "",
    logo_url: rev.logo_url || "",
    whatsapp: rev.whatsapp || "",
    instagram: rev.instagram || "",
    direccion: rev.direccion || "",
    ciudad: rev.ciudad || "",
    color: rev.color || "",
  });
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function logo(file?: File) {
    if (!file) return;
    setSubiendo(true);
    setError("");
    try {
      set("logo_url", await subirImagen(file, "revendedores", rev.slug));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubiendo(false);
    }
  }

  async function guardar() {
    setGuardando(true);
    setError("");
    try {
      const r = await api<Revendedor>(`/api/revendedor/${rev.slug}`, { method: "PUT", body: JSON.stringify(f) });
      onGuardado(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-4">
      {primeraVez && (
        <p className="rounded-2xl bg-dm/10 p-4 text-[15px] text-neutral-700">
          Cargá los datos de tu casa dental una sola vez. Van a aparecer en todos tus posteos y los podés cambiar cuando quieras.
        </p>
      )}

      <div>
        <span className="mb-1.5 block text-sm font-semibold text-neutral-600">Logo</span>
        <div className="flex items-center gap-4">
          <div className="grid h-24 w-36 shrink-0 place-items-center overflow-hidden rounded-2xl border border-dashed border-neutral-300 bg-[repeating-conic-gradient(#f2f2f2_0_25%,#fff_0_50%)] bg-[length:16px_16px]">
            {f.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.logo_url} alt="Logo" className="max-h-20 max-w-32 object-contain" />
            ) : (
              <span className="text-xs text-neutral-400">Sin logo</span>
            )}
          </div>
          <div className="space-y-2">
            <label className="btn-ghost cursor-pointer">
              {subiendo ? "Subiendo…" : f.logo_url ? "Cambiar logo" : "Subir logo"}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => logo(e.target.files?.[0])} />
            </label>
            {f.logo_url && (
              <button type="button" className="block text-sm text-neutral-500 underline" onClick={() => set("logo_url", "")}>
                Quitar logo
              </button>
            )}
            <p className="text-xs text-neutral-400">Ideal: PNG sin fondo.</p>
          </div>
        </div>
      </div>

      <Campo label="Nombre de la casa dental *">
        <input className="campo" value={f.nombre} onChange={(e) => set("nombre", e.target.value)} />
      </Campo>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="WhatsApp">
          <input className="campo" inputMode="tel" placeholder="11 1234-5678" value={f.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} />
        </Campo>
        <Campo label="Instagram">
          <input className="campo" placeholder="@tucasadental" value={f.instagram} onChange={(e) => set("instagram", e.target.value)} />
        </Campo>
        <Campo label="Dirección">
          <input className="campo" placeholder="Av. Siempre Viva 123" value={f.direccion} onChange={(e) => set("direccion", e.target.value)} />
        </Campo>
        <Campo label="Ciudad">
          <input className="campo" placeholder="Rosario, Santa Fe" value={f.ciudad} onChange={(e) => set("ciudad", e.target.value)} />
        </Campo>
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-semibold text-neutral-600">Color de tu marca (opcional)</span>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => set("color", "")} className={`chip ${!f.color ? "chip-on" : ""}`}>
            Usar color de cada marca
          </button>
          {COLORES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => set("color", c)}
              className={`h-9 w-9 rounded-full border-2 ${f.color === c ? "border-tinta ring-2 ring-tinta/20" : "border-white shadow"}`}
              style={{ background: c }}
              aria-label={c}
            />
          ))}
          <label className="relative h-9 w-9 cursor-pointer overflow-hidden rounded-full border-2 border-white bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)] shadow">
            <input type="color" className="absolute inset-0 opacity-0" value={f.color || "#f15922"} onChange={(e) => set("color", e.target.value)} />
          </label>
        </div>
      </div>

      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
      <button className="btn-dm w-full py-3.5 text-base" disabled={guardando || subiendo || !f.nombre.trim()} onClick={guardar}>
        {guardando ? "Guardando…" : primeraVez ? "Empezar a crear posteos" : "Guardar cambios"}
      </button>
    </div>
  );
}
