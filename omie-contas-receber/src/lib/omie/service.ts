import "server-only";
import { deDataOmie, hoje, paraDataOmie, round2 } from "../format";
import type { ClienteResumo, ContaCorrente, StatusTitulo, Titulo } from "../types";
import { chamarOmie, omieConfigurado, OmieError } from "./client";
import {
  alterarContaDemo,
  CLIENTES_DEMO,
  CONTAS_CORRENTE_DEMO,
  emitirBoletoDemo,
  excluirTituloDemo,
  incluirTituloDemo,
  lancarDescontoDemo,
  titulosDemo,
} from "./mock";

/*
 * Recursos e métodos da API Omie usados aqui. Se algum campo mudar na
 * documentação oficial, este arquivo é o único lugar a ajustar.
 *
 * financas/contareceber        -> ListarContasReceber, ConsultarContaReceber,
 *                                 IncluirContaReceber, AlterarContaReceber,
 *                                 ExcluirContaReceber, LancarRecebimento
 * financas/contareceberboleto  -> EmitirBoleto, ObterBoleto
 * geral/contacorrente          -> ListarContasCorrentes
 * geral/clientes               -> ListarClientesResumido
 */
const RECURSO_TITULOS = "financas/contareceber";
const RECURSO_BOLETO = "financas/contareceberboleto";
const RECURSO_CONTA_CORRENTE = "geral/contacorrente";
const RECURSO_CLIENTES = "geral/clientes";

export const modoDemonstracao = () => !omieConfigurado();

// ---------------------------------------------------------------- cache leve

const TTL_MS = 5 * 60 * 1000;
type Cache<T> = { valor: T; expira: number };
let cacheContas: Cache<ContaCorrente[]> | null = null;
let cacheClientes: Cache<ClienteResumo[]> | null = null;

// ------------------------------------------------------------ contas correntes

interface ContaCorrenteOmie {
  nCodCC?: number;
  descricao?: string;
  codigo_banco?: string;
  nome_banco?: string;
  tipo_conta_corrente?: string;
}

export async function listarContasCorrentes(): Promise<ContaCorrente[]> {
  if (modoDemonstracao()) return CONTAS_CORRENTE_DEMO;
  if (cacheContas && cacheContas.expira > Date.now()) return cacheContas.valor;

  const resposta = await chamarOmie<{
    ListarContasCorrentes?: ContaCorrenteOmie[];
    conta_corrente_cadastro?: ContaCorrenteOmie[];
  }>(RECURSO_CONTA_CORRENTE, "ListarContasCorrentes", {
    pagina: 1,
    registros_por_pagina: 200,
    apenas_importado_api: "N",
  });

  const brutas = resposta.ListarContasCorrentes ?? resposta.conta_corrente_cadastro ?? [];
  const contas = brutas
    .filter((c) => c.nCodCC)
    .map<ContaCorrente>((c) => ({
      id: Number(c.nCodCC),
      descricao: c.descricao?.trim() || `Conta ${c.nCodCC}`,
      banco: c.nome_banco?.trim() || c.codigo_banco?.trim() || null,
      tipo: c.tipo_conta_corrente ?? null,
    }));

  cacheContas = { valor: contas, expira: Date.now() + TTL_MS };
  return contas;
}

// ------------------------------------------------------------------- clientes

interface ClienteOmie {
  codigo_cliente?: number;
  nome_fantasia?: string;
  razao_social?: string;
  cnpj_cpf?: string;
}

export async function listarClientes(): Promise<ClienteResumo[]> {
  if (modoDemonstracao()) return CLIENTES_DEMO;
  if (cacheClientes && cacheClientes.expira > Date.now()) return cacheClientes.valor;

  const clientes: ClienteResumo[] = [];
  let pagina = 1;
  let totalPaginas = 1;

  do {
    const resposta = await chamarOmie<{
      clientes_cadastro_resumido?: ClienteOmie[];
      total_de_paginas?: number;
    }>(RECURSO_CLIENTES, "ListarClientesResumido", {
      pagina,
      registros_por_pagina: 500,
      apenas_importado_api: "N",
    });

    for (const c of resposta.clientes_cadastro_resumido ?? []) {
      if (!c.codigo_cliente) continue;
      clientes.push({
        id: Number(c.codigo_cliente),
        nome: (c.nome_fantasia || c.razao_social || `Cliente ${c.codigo_cliente}`).trim(),
        cnpj: (c.cnpj_cpf ?? "").replace(/\D/g, ""),
      });
    }

    totalPaginas = resposta.total_de_paginas ?? 1;
    pagina += 1;
  } while (pagina <= totalPaginas && pagina <= 20);

  cacheClientes = { valor: clientes, expira: Date.now() + TTL_MS };
  return clientes;
}

export function limparCacheOmie() {
  cacheContas = null;
  cacheClientes = null;
}

// --------------------------------------------------------------------- títulos

interface TituloOmie {
  nCodTitulo?: number;
  cNumTitulo?: string;
  cNumDocFiscal?: string;
  cNumParcela?: string;
  nCodCliente?: number;
  dDtEmissao?: string;
  dDtVenc?: string;
  nValorTitulo?: number;
  nCodCC?: number;
  cStatus?: string;
  observacao?: string;
  resumo?: {
    cLiquidado?: string;
    nValPago?: number;
    nValAberto?: number;
    nValDesconto?: number;
    nValJuros?: number;
    nValMulta?: number;
  };
}

export interface FiltroTitulos {
  pagina?: number;
  registrosPorPagina?: number;
  clienteId?: number;
  venceDe?: string;
  venceAte?: string;
}

export interface PaginaTitulos {
  titulos: Titulo[];
  pagina: number;
  totalPaginas: number;
  totalRegistros: number;
}

function classificarStatus(
  statusOmie: string | undefined,
  saldo: number,
  recebido: number,
  vencimento: string,
): StatusTitulo {
  const s = (statusOmie ?? "").toUpperCase();
  if (s.includes("CANCEL")) return "CANCELADO";
  if (saldo <= 0) return "RECEBIDO";
  if (recebido > 0) return "PARCIAL";
  if (vencimento && vencimento < hoje()) return "VENCIDO";
  return "A_VENCER";
}

function normalizarTitulo(
  bruto: TituloOmie,
  clientes: Map<number, ClienteResumo>,
  contas: Map<number, ContaCorrente>,
): Titulo {
  const valorOriginal = round2(bruto.nValorTitulo ?? 0);
  const recebido = round2(bruto.resumo?.nValPago ?? 0);
  const descontos = round2(bruto.resumo?.nValDesconto ?? 0);
  const saldo =
    bruto.resumo?.nValAberto != null
      ? round2(bruto.resumo.nValAberto)
      : round2(valorOriginal - recebido - descontos);

  const vencimento = deDataOmie(bruto.dDtVenc);
  const cliente = clientes.get(Number(bruto.nCodCliente));
  const conta = contas.get(Number(bruto.nCodCC));

  return {
    id: Number(bruto.nCodTitulo),
    numeroTitulo: bruto.cNumTitulo?.trim() || String(bruto.nCodTitulo ?? ""),
    numeroDocumento: bruto.cNumDocFiscal?.trim() || bruto.cNumTitulo?.trim() || "",
    parcela: bruto.cNumParcela?.trim() || "",
    clienteId: Number(bruto.nCodCliente ?? 0),
    clienteNome: cliente?.nome ?? `Cliente ${bruto.nCodCliente ?? "?"}`,
    clienteCnpj: cliente?.cnpj ?? "",
    emissao: deDataOmie(bruto.dDtEmissao),
    vencimento,
    valorOriginal,
    valorRecebido: recebido,
    valorDesconto: descontos,
    saldo,
    status: classificarStatus(bruto.cStatus, saldo, recebido, vencimento),
    contaCorrenteId: bruto.nCodCC ? Number(bruto.nCodCC) : null,
    contaCorrenteNome: conta?.descricao ?? null,
    boletoEmitido: false,
    boletoLink: null,
    linhaDigitavel: null,
    observacao: bruto.observacao?.trim() || null,
  };
}

export async function listarTitulos(filtro: FiltroTitulos = {}): Promise<PaginaTitulos> {
  const pagina = filtro.pagina ?? 1;
  const porPagina = filtro.registrosPorPagina ?? 50;

  if (modoDemonstracao()) {
    let lista = titulosDemo().slice();
    if (filtro.clienteId) lista = lista.filter((t) => t.clienteId === filtro.clienteId);
    if (filtro.venceDe) lista = lista.filter((t) => t.vencimento >= filtro.venceDe!);
    if (filtro.venceAte) lista = lista.filter((t) => t.vencimento <= filtro.venceAte!);
    lista.sort((a, b) => a.vencimento.localeCompare(b.vencimento));
    const inicio = (pagina - 1) * porPagina;
    return {
      titulos: lista.slice(inicio, inicio + porPagina),
      pagina,
      totalPaginas: Math.max(1, Math.ceil(lista.length / porPagina)),
      totalRegistros: lista.length,
    };
  }

  const param: Record<string, unknown> = {
    pagina,
    registros_por_pagina: porPagina,
    apenas_importado_api: "N",
    ordenar_por: "DATA_VENCIMENTO",
  };
  if (filtro.clienteId) param.filtrar_cliente = filtro.clienteId;
  if (filtro.venceDe) param.filtrar_por_data_vencimento_de = paraDataOmie(filtro.venceDe);
  if (filtro.venceAte) param.filtrar_por_data_vencimento_ate = paraDataOmie(filtro.venceAte);

  const [resposta, contas, clientes] = await Promise.all([
    chamarOmie<{
      conta_receber_cadastro?: TituloOmie[];
      total_de_paginas?: number;
      total_de_registros?: number;
    }>(RECURSO_TITULOS, "ListarContasReceber", param),
    listarContasCorrentes(),
    listarClientes(),
  ]);

  const mapaContas = new Map(contas.map((c) => [c.id, c]));
  const mapaClientes = new Map(clientes.map((c) => [c.id, c]));

  const titulos = (resposta.conta_receber_cadastro ?? [])
    .filter((t) => t.nCodTitulo)
    .map((t) => normalizarTitulo(t, mapaClientes, mapaContas));

  return {
    titulos,
    pagina,
    totalPaginas: resposta.total_de_paginas ?? 1,
    totalRegistros: resposta.total_de_registros ?? titulos.length,
  };
}

/** Registro completo do título (usado para replicar dados ao parcelar). */
export interface TituloCompleto {
  codigo_lancamento_omie?: number;
  codigo_cliente_fornecedor?: number;
  codigo_categoria?: string;
  id_conta_corrente?: number;
  valor_documento?: number;
  numero_documento_fiscal?: string;
  numero_parcela?: string;
  data_vencimento?: string;
  data_emissao?: string;
  data_previsao?: string;
  observacao?: string;
  [chave: string]: unknown;
}

export async function consultarTitulo(tituloId: number): Promise<TituloCompleto> {
  if (modoDemonstracao()) {
    const titulo = titulosDemo().find((t) => t.id === tituloId);
    if (!titulo) throw new OmieError(`Título ${tituloId} não encontrado.`);
    return {
      codigo_lancamento_omie: titulo.id,
      codigo_cliente_fornecedor: titulo.clienteId,
      codigo_categoria: "1.01.01",
      id_conta_corrente: titulo.contaCorrenteId ?? undefined,
      valor_documento: titulo.valorOriginal,
      numero_documento_fiscal: titulo.numeroDocumento,
      numero_parcela: titulo.parcela,
      data_vencimento: paraDataOmie(titulo.vencimento),
      data_emissao: paraDataOmie(titulo.emissao),
      observacao: titulo.observacao ?? "",
    };
  }

  return chamarOmie<TituloCompleto>(RECURSO_TITULOS, "ConsultarContaReceber", {
    codigo_lancamento_omie: tituloId,
  });
}

// ------------------------------------------------- desconto via recebimento

export interface LancamentoDesconto {
  tituloId: number;
  desconto: number;
  contaCorrenteId: number;
  /** Data do recebimento (yyyy-mm-dd). */
  data: string;
  observacao?: string;
}

/**
 * Lança o desconto na aba "Desconto" da tela Registrar Recebimento do Omie,
 * com Valor do Recebimento = 0. O título não é quitado: o saldo cai apenas
 * o valor do desconto e o restante continua a receber.
 */
export async function lancarDescontoRecebimento(dados: LancamentoDesconto) {
  const param = {
    codigo_lancamento: dados.tituloId,
    codigo_conta_corrente: dados.contaCorrenteId,
    valor: 0,
    desconto: round2(dados.desconto),
    juros: 0,
    multa: 0,
    data: paraDataOmie(dados.data),
    observacao: dados.observacao ?? "",
  };

  if (modoDemonstracao()) {
    return {
      param,
      resposta: lancarDescontoDemo(dados.tituloId, dados.desconto, dados.contaCorrenteId),
    };
  }

  const resposta = await chamarOmie<unknown>(RECURSO_TITULOS, "LancarRecebimento", param);
  return { param, resposta };
}

// ------------------------------------------------------- troca de conta corrente

/** Altera apenas a conta corrente do título — não cancela nem reemite boleto. */
export async function alterarContaCorrente(tituloId: number, contaCorrenteId: number) {
  const param = {
    codigo_lancamento_omie: tituloId,
    id_conta_corrente: contaCorrenteId,
  };

  if (modoDemonstracao()) {
    return { param, resposta: alterarContaDemo(tituloId, contaCorrenteId) };
  }

  const resposta = await chamarOmie<unknown>(RECURSO_TITULOS, "AlterarContaReceber", param);
  return { param, resposta };
}

// ---------------------------------------------------------------------- boleto

export interface RetornoBoleto {
  link: string | null;
  linhaDigitavel: string | null;
  mensagem: string | null;
}

interface BoletoOmie {
  cLinkBoleto?: string;
  cCodBarras?: string;
  cNumBoleto?: string;
  cCodStatus?: string;
  cMensagem?: string;
}

function normalizarBoleto(bruto: BoletoOmie): RetornoBoleto {
  return {
    link: bruto.cLinkBoleto?.trim() || null,
    linhaDigitavel: bruto.cCodBarras?.trim() || null,
    mensagem: bruto.cMensagem?.trim() || null,
  };
}

export async function emitirBoleto(tituloId: number) {
  const param = { nCodTitulo: tituloId, cCodIntTitulo: "" };

  if (modoDemonstracao()) {
    return { param, boleto: normalizarBoleto(emitirBoletoDemo(tituloId)) };
  }

  const resposta = await chamarOmie<BoletoOmie>(RECURSO_BOLETO, "EmitirBoleto", param);
  return { param, boleto: normalizarBoleto(resposta) };
}

export async function obterBoleto(tituloId: number): Promise<RetornoBoleto | null> {
  if (modoDemonstracao()) {
    const titulo = titulosDemo().find((t) => t.id === tituloId);
    if (!titulo?.boletoEmitido) return null;
    return {
      link: titulo.boletoLink,
      linhaDigitavel: titulo.linhaDigitavel,
      mensagem: null,
    };
  }

  try {
    const resposta = await chamarOmie<BoletoOmie>(RECURSO_BOLETO, "ObterBoleto", {
      nCodTitulo: tituloId,
      cCodIntTitulo: "",
    });
    const boleto = normalizarBoleto(resposta);
    return boleto.link || boleto.linhaDigitavel ? boleto : null;
  } catch {
    // Título sem boleto emitido devolve erro de negócio no Omie.
    return null;
  }
}

/**
 * Completa os títulos com dados do boleto. É uma chamada por título, então só
 * roda quando OMIE_BUSCAR_BOLETOS=1 — em listas grandes o custo é alto.
 */
export async function anexarBoletos(titulos: Titulo[]): Promise<Titulo[]> {
  if (modoDemonstracao()) return titulos;
  if (process.env.OMIE_BUSCAR_BOLETOS !== "1") return titulos;

  const completos: Titulo[] = [];
  for (const titulo of titulos) {
    const boleto = await obterBoleto(titulo.id);
    completos.push(
      boleto
        ? {
            ...titulo,
            boletoEmitido: true,
            boletoLink: boleto.link,
            linhaDigitavel: boleto.linhaDigitavel,
          }
        : titulo,
    );
  }
  return completos;
}

// ----------------------------------------------------------------- parcelamento

export interface NovoTitulo {
  clienteId: number;
  vencimento: string;
  valor: number;
  documento: string;
  parcela: string;
  contaCorrenteId: number | null;
  categoria?: string;
  observacao?: string;
}

export async function incluirTitulo(dados: NovoTitulo) {
  if (modoDemonstracao()) {
    return { param: dados, resposta: incluirTituloDemo(dados) };
  }

  const param: Record<string, unknown> = {
    codigo_cliente_fornecedor: dados.clienteId,
    data_vencimento: paraDataOmie(dados.vencimento),
    valor_documento: round2(dados.valor),
    codigo_categoria: dados.categoria,
    numero_documento_fiscal: dados.documento,
    numero_parcela: dados.parcela,
    data_previsao: paraDataOmie(dados.vencimento),
    observacao: dados.observacao ?? "",
  };
  if (dados.contaCorrenteId) param.id_conta_corrente = dados.contaCorrenteId;

  const resposta = await chamarOmie<unknown>(RECURSO_TITULOS, "IncluirContaReceber", param);
  return { param, resposta };
}

export async function excluirTitulo(tituloId: number) {
  const param = { codigo_lancamento_omie: tituloId };
  if (modoDemonstracao()) {
    return { param, resposta: excluirTituloDemo(tituloId) };
  }
  const resposta = await chamarOmie<unknown>(RECURSO_TITULOS, "ExcluirContaReceber", param);
  return { param, resposta };
}

// -------------------------------------------------------------------- conexão

export async function testarConexao(): Promise<{ ok: boolean; mensagem: string }> {
  if (modoDemonstracao()) {
    return {
      ok: false,
      mensagem:
        "Modo demonstração: defina OMIE_APP_KEY e OMIE_APP_SECRET para conectar ao Omie.",
    };
  }
  try {
    const contas = await listarContasCorrentes();
    return {
      ok: true,
      mensagem: `Conexão OK — ${contas.length} conta(s) corrente(s) encontradas.`,
    };
  } catch (erro) {
    return {
      ok: false,
      mensagem: erro instanceof Error ? erro.message : String(erro),
    };
  }
}
