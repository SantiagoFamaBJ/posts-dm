import { LogoDM } from "@/components/ui";

export default function Home() {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-white p-6">
      <div className="pointer-events-none absolute -right-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-dm/10" />
      <div className="pointer-events-none absolute -bottom-48 -left-40 h-[30rem] w-[30rem] rounded-full bg-dm/5" />
      <div className="relative max-w-md text-center">
        <LogoDM className="text-4xl" />
        <h1 className="mt-6 text-2xl font-extrabold leading-tight sm:text-3xl">
          Creá posteos profesionales de tus productos en segundos
        </h1>
        <p className="mt-3 text-lg text-neutral-600">
          Elegí el producto, poné tu logo y tu precio, y descargá la imagen lista para Instagram y WhatsApp.
        </p>
        <div className="mt-8 rounded-2xl bg-neutral-50 p-5 text-[15px] text-neutral-600">
          Para ingresar necesitás tu link personal. Pedíselo a tu vendedor de <strong>Dental Medrano</strong>.
        </div>
      </div>
    </main>
  );
}
