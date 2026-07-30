import { floor2, hoje, round2 } from "./format";
import type { Contrato, Titulo } from "./types";

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
  aviso: string | null;
  /** Preenchido quando o desconto não pode ser aplicado. */
  bloqueio: string | null;
}

export interface OpcoesPrevia {
  /** Saldo mínimo que o título pode ter após o desconto. */
  pisoSaldo?: number;
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
  const origem: "contrato" | "manual" = contrato ? "contrato" : "manual";

  const base: PreviaDesconto = {
    tituloId: titulo.id,
    clienteId: titulo.clienteId,
    clienteNome: titulo.clienteNome,
    documento: titulo.numeroDocumento || titulo.numeroTitulo,
    vencimento: titulo.vencimento,
    valorOriginal: titulo.valorOriginal,
    saldoAtual: titulo.saldo,
    percentual: contrato?.percentualDesconto ?? opcoes.percentualManual ?? 0,
    valorDesconto: 0,
    saldoFinal: titulo.saldo,
    origem,
    contratoId: contrato?.id ?? null,
    aviso: null,
    bloqueio: null,
  };

  if (titulo.status === "CANCELADO") {
    return { ...base, bloqueio: "Título cancelado no Omie." };
  }
  if (titulo.status === "RECEBIDO" || titulo.saldo <= 0) {
    return { ...base, bloqueio: "Título já liquidado — não há saldo a descontar." };
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
    avisos.push("Título já possui boleto emitido — confira o valor com o cliente antes do pagamento.");
  }

  const percentualEfetivo =
    titulo.saldo > 0 ? round2((desconto / titulo.saldo) * 100) : 0;

  return {
    ...base,
    percentual: origem === "manual" && opcoes.valorManual != null ? percentualEfetivo : base.percentual,
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
