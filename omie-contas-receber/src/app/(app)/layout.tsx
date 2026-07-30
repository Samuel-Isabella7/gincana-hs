import { Sidebar } from "@/components/Sidebar";
import { exigirSessao } from "@/lib/auth";
import { modoDemonstracao } from "@/lib/omie/service";
import { usandoSupabase } from "@/lib/store";

export default async function LayoutInterno({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessao = await exigirSessao();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar nome={sessao.nome} perfil={sessao.perfil} />

      <div className="flex-1 overflow-x-hidden">
        {modoDemonstracao() && (
          <div className="border-b border-borda bg-alerta-suave px-4 py-2 text-sm text-alerta">
            <strong>Modo demonstração.</strong> Os dados abaixo são fictícios. Configure
            <code className="mx-1 rounded bg-cartao px-1 py-0.5 text-xs">OMIE_APP_KEY</code>
            e
            <code className="mx-1 rounded bg-cartao px-1 py-0.5 text-xs">OMIE_APP_SECRET</code>
            para operar no Omie de verdade.
            {!usandoSupabase() && " Contratos e auditoria estão sendo gravados em .data/store.json."}
          </div>
        )}
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
