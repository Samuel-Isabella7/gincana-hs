import { floor2, hoje, round2 } from "./format";
import type { CategoriaProduto, Contrato, RegraDesconto, Titulo } from "./types";

export interface PreviaDesconto {
  tituloId: number;
  clienteId: number;
  clienteNome: string;
  documento: string;
  vencimento: string;
  valorOriginal: number;
  saldoAtual: number;
  percentual: number;
  valorDesconto: number;
  /** Quanto restará a receber depois do lançamento — o título continua aberto. */
  saldoFinal: number;
  origem: "contrato" | "manual";
  contratoId: string | null;
  regraId: string | null;
  regraRotulo: string | null;
  aviso: string | null;
  /** Preenchido quando o desconto não pode ser aplicado. */
  bloqueio: string | null;
}

export interface OpcoesPrevia {
  /** Saldo mínimo que o título pode ter após o desconto. */
  pisoSaldo?: number;
  /** Regra do contrato escolhida na tela. */
  regraId?: string;
  /** Alternativa à regra: escolher pela categoria do produto. */
  categoria?: CategoriaProduto;
  /** Percentual avulso (desconto manual). Ignorado quando há contrato. */
  percentualManual?: number;
  /** Valor avulso em R$ (desconto manual). Tem prioridade sobre o percentual. */
  valorManual?: number;
}

/** Contrato ativo e dentro da vigência para o cliente, se existir. */
export function contratoVigente(
  contratos: Contrato[],
  clienteId: number,
  data: string = hoje(),
): Contrato | null {
  const encontrado = contratos.find((c) => {
    if (c.omieClienteId !== clienteId || !c.ativo) return false;
    if (c.vigenciaInicio && data < c.vigenciaInicio) return false;
    if (c.vigenciaFim && data > c.vigenciaFim) return false;
    return true;
  });
  return encontrado ?? null;
}

/** Escolhe a regra: a informada na tela, a da categoria, a padrão ou a única. */
export function escolherRegra(
  contrato: Contrato | null,
  opcoes: { regraId?: string; categoria?: CategoriaProduto } = {},
): RegraDesconto | null {
  if (!contrato?.regras?.length) return null;

  if (opcoes.regraId) {
    const exata = contrato.regras.find((r) => r.id === opcoes.regraId);
    if (exata) return exata;
  }

  if (opcoes.categoria) {
    const porCategoria = contrato.regras.find((r) => r.categoria === opcoes.categoria);
    if (porCategoria) return porCategoria;
  }

  return (
    contrato.regras.find((r) => r.padrao) ??
    (contrato.regras.length === 1 ? contrato.regras[0] : null)
  );
}

export function precisaEscolherRegra(contrato: Contrato | null): boolean {
  if (!contrato?.regras?.length) return false;
  return contrato.regras.length > 1 && !contrato.regras.some((r) => r.padrao);
}

export function descreverRegras(contrato: Contrato): string {
  if (!contrato.regras.length) return "sem desconto";
  return contrato.regras
    .map((r) => `${r.rotulo} ${r.percentual.toFixed(2).replace(".", ",")}%`)
    .join(" · ");
}

/**
 * Calcula o desconto de um título antes de gravar no Omie.
 *
 * O desconto é lançado como um recebimento de valor zero com o valor no campo
 * "Desconto", então o efeito esperado é reduzir o saldo mantendo o título aberto.
 */
export function calcularPrevia(
  titulo: Titulo,
  contrato: Contrato | null,
  opcoes: OpcoesPrevia = {},
): PreviaDesconto {
  const piso = opcoes.pisoSaldo ?? 0;
  const regra = escolherRegra(contrato, opcoes);
  const origem: "contrato" | "manual" = regra ? "contrato" : "manual";

  const base: PreviaDesconto = {
    tituloId: titulo.id,
    clienteId: titulo.clienteId,
    clienteNome: titulo.clienteNome,
    documento: titulo.numeroDocumento || titulo.numeroTitulo,
    vencimento: titulo.vencimento,
    valorOriginal: titulo.valorOriginal,
    saldoAtual: titulo.saldo,
    percentual: regra?.percentual ?? opcoes.percentualManual ?? 0,
    valorDesconto: 0,
    saldoFinal: titulo.saldo,
    origem,
    contratoId: contrato?.id ?? null,
    regraId: regra?.id ?? null,
    regraRotulo: regra?.rotulo ?? null,
    aviso: null,
    bloqueio: null,
  };

  if (titulo.status === "CANCELADO") {
    return { ...base, bloqueio: "Título cancelado no Omie." };
  }
  if (titulo.status === "RECEBIDO" || titulo.saldo <= 0) {
    return { ...base, bloqueio: "Título já liquidado — não há saldo a descontar." };
  }
  if (contrato && !regra) {
    return {
      ...base,
      bloqueio: contrato.regras.length
        ? "Escolha a faixa de desconto deste contrato (categoria/praça)."
        : "Contrato sem desconto — este cliente só tem banco definido.",
    };
  }

  let desconto: number;
  if (origem === "manual" && opcoes.valorManual != null) {
    desconto = floor2(opcoes.valorManual);
  } else {
    desconto = floor2((titulo.saldo * base.percentual) / 100);
  }

  const avisos: string[] = [];

  if (contrato?.tetoDesconto != null && desconto > contrato.tetoDesconto) {
    desconto = floor2(contrato.tetoDesconto);
    avisos.push(`Teto de contrato aplicado (R$ ${contrato.tetoDesconto.toFixed(2)}).`);
  }

  if (round2(titulo.saldo - desconto) < piso) {
    desconto = floor2(titulo.saldo - piso);
    avisos.push(`Desconto limitado para respeitar o saldo mínimo de R$ ${piso.toFixed(2)}.`);
  }

  if (desconto <= 0) {
    return {
      ...base,
      valorDesconto: 0,
      bloqueio:
        origem === "contrato"
          ? "Percentual de contrato resulta em desconto zero."
          : "Informe um valor ou percentual de desconto maior que zero.",
      aviso: avisos.join(" ") || null,
    };
  }

  if (titulo.boletoEmitido) {
    avisos.push(
      "Título já possui boleto emitido — confira o valor com o cliente antes do pagamento.",
    );
  }

  const percentualEfetivo = titulo.saldo > 0 ? round2((desconto / titulo.saldo) * 100) : 0;

  return {
    ...base,
    percentual:
      origem === "manual" && opcoes.valorManual != null ? percentualEfetivo : base.percentual,
    valorDesconto: desconto,
    saldoFinal: round2(titulo.saldo - desconto),
    aviso: avisos.join(" ") || null,
  };
}

export function totalizarPrevias(previas: PreviaDesconto[]) {
  const aplicaveis = previas.filter((p) => !p.bloqueio);
  return {
    quantidade: aplicaveis.length,
    saldoOriginal: round2(aplicaveis.reduce((s, p) => s + p.saldoAtual, 0)),
    desconto: round2(aplicaveis.reduce((s, p) => s + p.valorDesconto, 0)),
    saldoFinal: round2(aplicaveis.reduce((s, p) => s + p.saldoFinal, 0)),
  };
}
