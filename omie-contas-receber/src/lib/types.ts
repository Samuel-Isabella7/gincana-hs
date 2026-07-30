export type StatusTitulo =
  | "A_VENCER"
  | "VENCIDO"
  | "PARCIAL"
  | "RECEBIDO"
  | "CANCELADO";

/** Título de contas a receber, já normalizado a partir do retorno do Omie. */
export interface Titulo {
  id: number;
  numeroTitulo: string;
  numeroDocumento: string;
  parcela: string;
  clienteId: number;
  clienteNome: string;
  clienteCnpj: string;
  emissao: string; // yyyy-mm-dd
  vencimento: string; // yyyy-mm-dd
  valorOriginal: number;
  valorRecebido: number;
  valorDesconto: number;
  /** Quanto ainda resta receber da conta (valor original - recebido - descontos). */
  saldo: number;
  status: StatusTitulo;
  contaCorrenteId: number | null;
  contaCorrenteNome: string | null;
  boletoEmitido: boolean;
  boletoLink: string | null;
  linhaDigitavel: string | null;
  observacao: string | null;
}

export interface ContaCorrente {
  id: number;
  descricao: string;
  banco: string | null;
  tipo: string | null;
}

export interface ClienteResumo {
  id: number;
  nome: string;
  cnpj: string;
}

export type CategoriaProduto = "geral" | "secos" | "congelados";

/**
 * Uma faixa de desconto do contrato. Clientes com percentual diferente por
 * categoria (secos/congelados) ou por praça (SP/RJ) têm uma regra para cada.
 */
export interface RegraDesconto {
  id: string;
  /** Como a regra aparece na tela, ex: "secos SP". */
  rotulo: string;
  percentual: number;
  categoria: CategoriaProduto;
  uf: string | null;
  /** Regra sugerida quando o operador não escolhe outra. */
  padrao: boolean;
}

/**
 * Cliente especial. Pode ter uma ou mais regras de desconto — ou nenhuma, no
 * caso de cliente que só precisa ser cobrado sempre em um banco específico.
 */
export interface Contrato {
  id: string;
  omieClienteId: number;
  nome: string;
  cnpj: string;
  /** Rede/grupo, quando várias razões sociais compartilham a negociação. */
  grupo: string | null;
  regras: RegraDesconto[];
  vigenciaInicio: string | null;
  vigenciaFim: string | null;
  /** Teto de desconto em R$ por título (opcional). */
  tetoDesconto: number | null;
  contaCorrentePreferencial: number | null;
  /** Mover o título para a conta preferencial sempre que ele for operado. */
  aplicarContaSempre: boolean;
  ativo: boolean;
  observacoes: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export type AcaoAuditoria =
  | "desconto"
  | "boleto"
  | "parcelamento"
  | "conta_corrente"
  | "contrato"
  | "login";

export interface EventoAuditoria {
  id: string;
  usuario: string;
  acao: AcaoAuditoria;
  entidade: string;
  descricao: string;
  payloadEnviado: unknown;
  respostaOmie: unknown;
  sucesso: boolean;
  erro: string | null;
  criadoEm: string;
}

export interface Config {
  /** Saldo mínimo que um título pode ter após o desconto (R$). */
  pisoSaldo: number;
  /** Desconto manual acima deste valor exige perfil gestor. */
  limiteDescontoManual: number;
  /** Conta corrente usada quando o título não tem conta definida. */
  contaCorrentePadrao: number | null;
}

export type Perfil = "operador" | "gestor";

export interface Usuario {
  usuario: string;
  nome: string;
  perfil: Perfil;
  senhaHash: string;
}

/** Resultado de uma operação individual dentro de uma execução em lote. */
export interface ResultadoItem {
  tituloId: number;
  sucesso: boolean;
  mensagem: string;
  /** Verdadeiro quando o lançamento foi para a fila de aprovação do gestor. */
  pendente?: boolean;
  detalhe?: unknown;
}

export type StatusAprovacao = "pendente" | "aprovado" | "rejeitado";

/** Desconto manual acima do limite: espera decisão de um gestor. */
export interface Aprovacao {
  id: string;
  tituloId: number;
  clienteId: number;
  clienteNome: string;
  documento: string;
  saldo: number;
  percentual: number;
  valorDesconto: number;
  saldoFinal: number;
  justificativa: string;
  solicitante: string;
  contaCorrenteId: number | null;
  data: string;
  status: StatusAprovacao;
  criadoEm: string;
  decididoEm: string | null;
  decisor: string | null;
  observacaoDecisao: string | null;
}

/** O que fazer com o título original depois de criar as parcelas. */
export type PoliticaOriginal = "baixado" | "excluido";

export interface RegistroParcelamento {
  id: string;
  tituloOrigem: number;
  clienteNome: string;
  quantidade: number;
  valorTotal: number;
  politicaOriginal: PoliticaOriginal;
  titulosGerados: Array<{
    numero: number;
    tituloId: number | null;
    vencimento: string;
    valor: number;
    boleto: boolean;
  }>;
  boletosEmitidos: number;
  usuario: string;
  criadoEm: string;
}
