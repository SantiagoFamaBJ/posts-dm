"use client";

import { useEffect, type ReactNode } from "react";

export function Toggle({ on, onChange, label, sub }: { on: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className="flex w-full items-center justify-between gap-3 py-2 text-left">
      <span>
        <span className="block font-semibold text-neutral-800">{label}</span>
        {sub && <span className="block text-sm text-neutral-500">{sub}</span>}
      </span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-dm" : "bg-neutral-300"}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-6" : "left-1"}`} />
      </span>
    </button>
  );
}

export function Campo({ label, children, ayuda }: { label: string; children: ReactNode; ayuda?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-neutral-600">{label}</span>
      {children}
      {ayuda && <span className="mt-1 block text-xs text-neutral-400">{ayuda}</span>}
    </label>
  );
}

export function Seccion({ titulo, numero, children }: { titulo: string; numero?: number; children: ReactNode }) {
  return (
    <section className="tarjeta p-4 sm:p-5">
      <h2 className="mb-3 flex items-center gap-2.5 text-[15px] font-extrabold uppercase tracking-wide text-tinta">
        {numero !== undefined && (
          <span className="grid h-6 w-6 place-items-center rounded-full bg-dm text-xs text-white">{numero}</span>
        )}
        {titulo}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function Modal({ abierto, onCerrar, titulo, children, ancho = "max-w-2xl" }: { abierto: boolean; onCerrar: () => void; titulo: string; children: ReactNode; ancho?: string }) {
  useEffect(() => {
    if (!abierto) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    document.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", k);
      document.body.style.overflow = "";
    };
  }, [abierto, onCerrar]);
  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onCerrar}>
      <div
        className={`flex max-h-[92vh] w-full ${ancho} flex-col overflow-hidden rounded-t-3xl bg-white sm:rounded-3xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
          <h3 className="text-lg font-extrabold">{titulo}</h3>
          <button onClick={onCerrar} className="grid h-9 w-9 place-items-center rounded-full bg-neutral-100 text-xl leading-none text-neutral-600" aria-label="Cerrar">
            ×
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function Aviso({ texto, tipo = "ok" }: { texto: string; tipo?: "ok" | "error" }) {
  if (!texto) return null;
  return (
    <div
      className={`fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-lg ${tipo === "ok" ? "bg-tinta" : "bg-red-600"}`}
    >
      {texto}
    </div>
  );
}

export function LogoDM({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display font-extrabold tracking-tight ${className}`}>
      <span className="text-dm">Posts</span> DM
    </span>
  );
}
