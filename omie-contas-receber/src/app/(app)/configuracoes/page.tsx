import { ConfiguracoesView } from "@/components/configuracoes/ConfiguracoesView";
import { Pagina } from "@/components/Pagina";
import { exigirSessao } from "@/lib/auth";
import { listarContasCorrentes, modoDemonstracao } from "@/lib/omie/service";
import { garantirAdmin, lerConfig, listarUsuarios, usandoSupabase } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Mostra só o final da credencial, o suficiente para conferir qual está ativa. */
function mascarar(valor: string | undefined): string {
  if (!valor) return "não configurada";
  const final = valor.slice(-4);
  return `${"•".repeat(Math.min(20, Math.max(4, valor.length - 4)))}${final}`;
}

export default async function ConfiguracoesPage() {
  const sessao = await exigirSessao();
  await garantirAdmin();

  const [config, contas, usuarios] = await Promise.all([
    lerConfig(),
    listarContasCorrentes().catch(() => []),
    listarUsuarios(),
  ]);

  return (
    <Pagina
      titulo="Configurações"
      fonte="geral/contacorrente · ListarContasCorrentes"
      demonstracao={modoDemonstracao()}
    >
      <ConfiguracoesView
        config={config}
        contas={contas}
        perfil={sessao.perfil}
        omieConectado={!modoDemonstracao()}
        usandoSupabase={usandoSupabase()}
        chaveMascarada={{
          appKey: mascarar(process.env.OMIE_APP_KEY),
          appSecret: mascarar(process.env.OMIE_APP_SECRET),
        }}
        usuarios={usuarios.map((u) => ({
          usuario: u.usuario,
          nome: u.nome,
          perfil: u.perfil,
        }))}
      />
    </Pagina>
  );
}
