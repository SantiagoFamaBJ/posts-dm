import Editor from "@/components/Editor";
import { LogoDM } from "@/components/ui";
import { db } from "@/lib/server";
import type { Revendedor } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { data } = await db().from("posts_revendedores").select("*").eq("slug", slug).eq("activo", true).maybeSingle();

  if (!data)
    return (
      <main className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <LogoDM className="text-3xl" />
          <p className="mt-4 text-neutral-600">Este link no existe o fue desactivado.</p>
          <p className="text-neutral-500">Pedile uno nuevo a tu vendedor de Dental Medrano.</p>
        </div>
      </main>
    );

  return <Editor revInicial={data as Revendedor} />;
}
