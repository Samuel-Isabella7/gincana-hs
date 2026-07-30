/**
 * Contratos de entrada das operações (compartilhados entre as telas e as rotas
 * de API). Ficam separados de `operacoes.ts` porque aquele módulo é server-only.
 */

export interface ItemDesconto {
  tituloId: number;
  clienteId: number;
  clienteNome?: string;
  documento?: string;
  saldo: number;
  valorOriginal?: number;
  vencimento?: string;
  boletoEmitido?: boolean;
  contaCorrenteTituloId?: number | null;
  /** Desconto manual (usado só quando o cliente não tem contrato vigente). */
  valorManual?: number;
  percentualManual?: number;
  justificativa?: string;
}

export interface EntradaDescontos {
  itens: ItemDesconto[];
  /** Data do recebimento lançado no Omie (yyyy-mm-dd). */
  data?: string;
  /** Conta corrente escolhida na tela para o lançamento. */
  contaCorrenteId?: number | null;
  /** Quando verdadeiro, também altera a conta corrente do título. */
  trocarConta?: boolean;
  observacao?: string;
}

export interface EntradaParcelamento {
  tituloId: number;
  clienteId: number;
  clienteNome?: string;
  saldo: number;
  documento?: string;
  quantidade: number;
  primeiroVencimento: string;
  intervaloDias?: number;
  acrescimoPercentual?: number;
  datas?: string[];
  contaCorrenteId?: number | null;
  /**
   * O que fazer com o título original:
   * - "baixado": lança um recebimento de valor zero com desconto igual ao saldo,
   *   zerando o título (fica liquidado, substituído pelas parcelas).
   * - "excluido": remove o título do Omie via ExcluirContaReceber.
   */
  politicaOriginal?: "baixado" | "excluido";
  emitirBoletos?: boolean;
}

export interface ResultadoParcelamento {
  parcelas: Array<{
    numero: number;
    vencimento: string;
    valor: number;
    tituloId: number | null;
    sucesso: boolean;
    mensagem: string;
    boleto?: { link: string | null; linhaDigitavel: string | null } | null;
  }>;
  originalExcluido: boolean;
  originalBaixado?: boolean;
  mensagemOriginal: string | null;
}
