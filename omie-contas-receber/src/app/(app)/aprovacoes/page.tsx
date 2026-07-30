import { AprovacoesView } from "@/components/aprovacoes/AprovacoesView";
import { Pagina } from "@/components/Pagina";
import { exigirSessao } from "@/lib/auth";
import { modoDemonstracao } from "@/lib/omie/service";
import { listarAprovacoes } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function AprovacoesPage() {
  const sessao = await exigirSessao();
  const aprovacoes = await listarAprovacoes();

  return (
    <Pagina
      titulo="Aprovações pendentes"
      fonte="supabase · aprovacoes"
      demonstracao={modoDemonstracao()}
    >
      <AprovacoesView aprovacoes={aprovacoes} perfil={sessao.perfil} />
    </Pagina>
  );
}
