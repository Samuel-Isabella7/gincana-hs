import { ContratosView } from "@/components/clientes/ContratosView";
import { exigirSessao } from "@/lib/auth";
import { listarContasCorrentes } from "@/lib/omie/service";
import { listarContratos } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const sessao = await exigirSessao();
  const [contratos, contas] = await Promise.all([
    listarContratos(),
    listarContasCorrentes().catch(() => []),
  ]);

  return <ContratosView contratos={contratos} contas={contas} perfil={sessao.perfil} />;
}
