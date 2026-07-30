import { ContratosView } from "@/components/clientes/ContratosView";
import { Pagina } from "@/components/Pagina";
import { exigirSessao } from "@/lib/auth";
import { listarContasCorrentes, modoDemonstracao } from "@/lib/omie/service";
import { listarContratos, listarEventos } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const sessao = await exigirSessao();
  const [contratos, contas, historico] = await Promise.all([
    listarContratos(),
    listarContasCorrentes().catch(() => []),
    listarEventos({ acao: "contrato", limite: 300 }),
  ]);

  return (
    <Pagina
      titulo="Clientes especiais"
      fonte="supabase · contratos"
      demonstracao={modoDemonstracao()}
    >
      <ContratosView
        contratos={contratos}
        contas={contas}
        perfil={sessao.perfil}
        historico={historico}
      />
    </Pagina>
  );
}
