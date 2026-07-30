import { floor2, round2, somarDias } from "./format";

export interface ParcelaPrevia {
  numero: number;
  vencimento: string;
  valor: number;
}

export interface OpcoesParcelamento {
  /** Saldo do título que será parcelado. */
  total: number;
  quantidade: number;
  primeiroVencimento: string;
  /** Intervalo em dias entre as parcelas. Ignorado se datas forem informadas. */
  intervaloDias?: number;
  /** Acréscimo percentual sobre o total (juros do parcelamento). */
  acrescimoPercentual?: number;
  /** Datas customizadas por parcela (yyyy-mm-dd). */
  datas?: string[];
}

export const MIN_PARCELAS = 2;
export const MAX_PARCELAS = 12;

/**
 * Divide o saldo em parcelas. A diferença de arredondamento fica na primeira
 * parcela, então a soma das parcelas é sempre igual ao total.
 */
export function gerarParcelas(opcoes: OpcoesParcelamento): ParcelaPrevia[] {
  const { total, quantidade, primeiroVencimento } = opcoes;
  const intervalo = opcoes.intervaloDias ?? 30;
  const acrescimo = opcoes.acrescimoPercentual ?? 0;

  if (quantidade < MIN_PARCELAS || quantidade > MAX_PARCELAS) {
    throw new Error(`Quantidade de parcelas deve estar entre ${MIN_PARCELAS} e ${MAX_PARCELAS}.`);
  }
  if (total <= 0) {
    throw new Error("Título sem saldo para parcelar.");
  }
  if (!primeiroVencimento && !opcoes.datas?.length) {
    throw new Error("Informe a data da primeira parcela.");
  }

  const totalComAcrescimo = round2(total * (1 + acrescimo / 100));
  const valorBase = floor2(totalComAcrescimo / quantidade);
  const resto = round2(totalComAcrescimo - valorBase * quantidade);

  return Array.from({ length: quantidade }, (_, i) => ({
    numero: i + 1,
    vencimento:
      opcoes.datas?.[i] ?? somarDias(primeiroVencimento, intervalo * i),
    valor: i === 0 ? round2(valorBase + resto) : valorBase,
  }));
}

export function somarParcelas(parcelas: ParcelaPrevia[]): number {
  return round2(parcelas.reduce((s, p) => s + p.valor, 0));
}
