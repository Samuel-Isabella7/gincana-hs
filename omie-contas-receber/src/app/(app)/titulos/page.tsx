import { Pagina } from "@/components/Pagina";
import { TitulosView } from "@/components/titulos/TitulosView";
import { exigirSessao } from "@/lib/auth";
import { hoje, somarDias } from "@/lib/format";
import { mensagemErro } from "@/lib/omie/client";
import {
  anexarBoletos,
  listarContasCorrentes,
  listarTitulos,
  modoDemonstracao,
} from "@/lib/omie/service";
import { lerConfig, listarContratos } from "@/lib/store";

export const dynamic = "force-dynamic";

interface Parametros {
  venceDe?: string;
  venceAte?: string;
  pagina?: string;
  porPagina?: string;
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
  const porPagina = Number(parametros.porPagina ?? 50) || 50;

  const dados = await carregar({ pagina, porPagina, venceDe, venceAte });

  return (
    <Pagina
      titulo="Títulos a receber"
      fonte="financas/contareceber · ListarContasReceber"
      demonstracao={modoDemonstracao()}
    >
      {"erro" in dados ? (
        <div className="cartao p-6">
          <h2 className="titulo-secao">Não foi possível carregar os títulos</h2>
          <p className="mt-2 text-[12.5px] text-negativo">{dados.erro}</p>
          <p className="mt-3 text-[12.5px] text-suave">
            Verifique as credenciais do Omie em Configurações e tente novamente.
          </p>
        </div>
      ) : (
        <TitulosView
          titulos={dados.titulos}
          contratos={dados.contratos}
          contas={dados.contas}
          config={dados.config}
          perfil={sessao.perfil}
          pagina={dados.pagina}
          totalPaginas={dados.totalPaginas}
          totalRegistros={dados.totalRegistros}
          porPagina={porPagina}
          venceDe={venceDe}
          venceAte={venceAte}
        />
      )}
    </Pagina>
  );
}

async function carregar({
  pagina,
  porPagina,
  venceDe,
  venceAte,
}: {
  pagina: number;
  porPagina: number;
  venceDe: string;
  venceAte: string;
}) {
  try {
    const [resultado, contas, contratos, config] = await Promise.all([
      listarTitulos({ pagina, registrosPorPagina: porPagina, venceDe, venceAte }),
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
