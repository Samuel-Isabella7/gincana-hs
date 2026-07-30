import { ConfiguracoesView } from "@/components/configuracoes/ConfiguracoesView";
import { exigirSessao } from "@/lib/auth";
import { listarContasCorrentes, modoDemonstracao } from "@/lib/omie/service";
import { lerConfig, usandoSupabase } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const sessao = await exigirSessao();
  const [config, contas] = await Promise.all([
    lerConfig(),
    listarContasCorrentes().catch(() => []),
  ]);

  return (
    <ConfiguracoesView
      config={config}
      contas={contas}
      perfil={sessao.perfil}
      omieConectado={!modoDemonstracao()}
      usandoSupabase={usandoSupabase()}
    />
  );
}
