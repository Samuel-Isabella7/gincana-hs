import { TitulosView } from "@/components/titulos/TitulosView";
import { exigirSessao } from "@/lib/auth";
import { hoje, somarDias } from "@/lib/format";
import { mensagemErro } from "@/lib/omie/client";
import {
  anexarBoletos,
  listarContasCorrentes,
  listarTitulos,
} from "@/lib/omie/service";
import { lerConfig, listarContratos } from "@/lib/store";

export const dynamic = "force-dynamic";

interface Parametros {
  venceDe?: string;
  venceAte?: string;
  pagina?: string;
}

export default async function TitulosPage({
  searchParams,
}: {
  searchParams: Promise<Parametros>;
}) {
  const sessao = await exigirSessao();
  const parametros = await searchParams;

  const venceDe = parametros.venceDe || somarDias(hoje(), -60);
  const venceAte = parametros.venceAte || somarDias(hoje(), 120);
  const pagina = Number(parametros.pagina ?? 1) || 1;

  const dados = await carregar({ pagina, venceDe, venceAte });

  if ("erro" in dados) {
    return (
      <div className="cartao p-6">
        <h1 className="titulo-secao">Não foi possível carregar os títulos</h1>
        <p className="mt-2 text-sm text-negativo">{dados.erro}</p>
        <p className="mt-3 text-sm text-suave">
          Verifique as credenciais do Omie em Configurações e tente novamente.
        </p>
      </div>
    );
  }

  return (
    <TitulosView
      titulos={dados.titulos}
      contratos={dados.contratos}
      contas={dados.contas}
      config={dados.config}
      perfil={sessao.perfil}
      pagina={dados.pagina}
      totalPaginas={dados.totalPaginas}
      totalRegistros={dados.totalRegistros}
      venceDe={venceDe}
      venceAte={venceAte}
    />
  );
}

async function carregar({
  pagina,
  venceDe,
  venceAte,
}: {
  pagina: number;
  venceDe: string;
  venceAte: string;
}) {
  try {
    const [resultado, contas, contratos, config] = await Promise.all([
      listarTitulos({ pagina, registrosPorPagina: 50, venceDe, venceAte }),
      listarContasCorrentes(),
      listarContratos(),
      lerConfig(),
    ]);

    return {
      titulos: await anexarBoletos(resultado.titulos),
      contas,
      contratos,
      config,
      pagina: resultado.pagina,
      totalPaginas: resultado.totalPaginas,
      totalRegistros: resultado.totalRegistros,
    };
  } catch (erro) {
    return { erro: mensagemErro(erro) };
  }
}
