import { Sidebar } from "@/components/Sidebar";
import { ProvedorToasts } from "@/components/ui/Toasts";
import { exigirSessao } from "@/lib/auth";
import { contarAprovacoesPendentes } from "@/lib/store";

export default async function LayoutInterno({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessao = await exigirSessao();
  const pendentes = await contarAprovacoesPendentes();

  return (
    <ProvedorToasts>
      <div className="flex min-h-screen">
        <Sidebar
          nome={sessao.nome}
          usuario={sessao.usuario}
          perfil={sessao.perfil}
          aprovacoesPendentes={pendentes}
        />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </ProvedorToasts>
  );
}
