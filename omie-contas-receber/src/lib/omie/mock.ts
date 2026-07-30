import "server-only";
import { hoje, round2, somarDias } from "../format";
import type { ClienteResumo, ContaCorrente, Titulo } from "../types";

/**
 * Dados de demonstração usados quando as credenciais do Omie não estão
 * configuradas. As mutações ficam em memória e são perdidas ao reiniciar o
 * servidor — servem só para exercitar as telas.
 */

export const CONTAS_CORRENTE_DEMO: ContaCorrente[] = [
  { id: 1001, descricao: "Itaú Garantia", banco: "341 - Itaú", tipo: "CONTA_CORRENTE" },
  { id: 1002, descricao: "Itaú Movimento", banco: "341 - Itaú", tipo: "CONTA_CORRENTE" },
  { id: 1003, descricao: "Sicoob Cobrança", banco: "756 - Sicoob", tipo: "CONTA_CORRENTE" },
  { id: 1004, descricao: "Bradesco Carteira 09", banco: "237 - Bradesco", tipo: "CONTA_CORRENTE" },
];

export const CLIENTES_DEMO: ClienteResumo[] = [
  { id: 5001, nome: "Supermercado Boa Praça Ltda", cnpj: "12345678000190" },
  { id: 5002, nome: "Rede Central de Alimentos SA", cnpj: "98765432000121" },
  { id: 5003, nome: "Empório do Chef Comércio Ltda", cnpj: "45678912000133" },
  { id: 5004, nome: "Restaurante Sabor Caseiro ME", cnpj: "78912345000144" },
  { id: 5005, nome: "Atacadão Vale Verde Ltda", cnpj: "32165498000155" },
  { id: 5006, nome: "Padaria Pão Nosso Ltda", cnpj: "65498732000166" },
];

function criarTitulos(): Titulo[] {
  const base = hoje();
  const cliente = (id: number) => CLIENTES_DEMO.find((c) => c.id === id)!;
  const conta = (id: number) => CONTAS_CORRENTE_DEMO.find((c) => c.id === id)!;

  const definicoes: Array<{
    id: number;
    clienteId: number;
    doc: string;
    parcela: string;
    diasVenc: number;
    valor: number;
    recebido?: number;
    desconto?: number;
    contaId: number;
    boleto?: boolean;
  }> = [
    { id: 90001, clienteId: 5001, doc: "NF 14523", parcela: "001/001", diasVenc: 35, valor: 2101, contaId: 1001, boleto: true },
    { id: 90002, clienteId: 5001, doc: "NF 14588", parcela: "001/002", diasVenc: 12, valor: 4380.5, contaId: 1001 },
    { id: 90003, clienteId: 5002, doc: "NF 14601", parcela: "001/001", diasVenc: 20, valor: 18750, contaId: 1002, boleto: true },
    { id: 90004, clienteId: 5002, doc: "NF 14602", parcela: "002/002", diasVenc: 50, valor: 18750, contaId: 1002 },
    { id: 90005, clienteId: 5003, doc: "NF 14610", parcela: "001/001", diasVenc: -8, valor: 3299.9, contaId: 1003 },
    { id: 90006, clienteId: 5003, doc: "NF 14655", parcela: "001/001", diasVenc: 7, valor: 1120, contaId: 1003 },
    { id: 90007, clienteId: 5004, doc: "NF 14660", parcela: "001/003", diasVenc: -22, valor: 890.75, contaId: 1001 },
    { id: 90008, clienteId: 5004, doc: "NF 14661", parcela: "002/003", diasVenc: 8, valor: 890.75, recebido: 400, contaId: 1001 },
    { id: 90009, clienteId: 5005, doc: "NF 14690", parcela: "001/001", diasVenc: 28, valor: 26400, contaId: 1004, boleto: true },
    { id: 90010, clienteId: 5005, doc: "NF 14712", parcela: "001/001", diasVenc: 60, valor: 9870.4, contaId: 1004 },
    { id: 90011, clienteId: 5006, doc: "NF 14720", parcela: "001/001", diasVenc: -3, valor: 640.2, contaId: 1002 },
    { id: 90012, clienteId: 5006, doc: "NF 14733", parcela: "001/001", diasVenc: 15, valor: 1560, desconto: 60, contaId: 1002 },
    { id: 90013, clienteId: 5001, doc: "NF 14740", parcela: "001/001", diasVenc: 45, valor: 7320.8, contaId: 1001 },
    { id: 90014, clienteId: 5002, doc: "NF 14755", parcela: "001/001", diasVenc: 90, valor: 31200, contaId: 1002 },
  ];

  return definicoes.map((d) => {
    const c = cliente(d.clienteId);
    const cc = conta(d.contaId);
    const recebido = d.recebido ?? 0;
    const desconto = d.desconto ?? 0;
    const saldo = round2(d.valor - recebido - desconto);
    const vencimento = somarDias(base, d.diasVenc);

    return {
      id: d.id,
      numeroTitulo: String(d.id),
      numeroDocumento: d.doc,
      parcela: d.parcela,
      clienteId: c.id,
      clienteNome: c.nome,
      clienteCnpj: c.cnpj,
      emissao: somarDias(vencimento, -30),
      vencimento,
      valorOriginal: d.valor,
      valorRecebido: recebido,
      valorDesconto: desconto,
      saldo,
      status:
        saldo <= 0
          ? ("RECEBIDO" as const)
          : recebido > 0
            ? ("PARCIAL" as const)
            : vencimento < base
              ? ("VENCIDO" as const)
              : ("A_VENCER" as const),
      contaCorrenteId: cc.id,
      contaCorrenteNome: cc.descricao,
      boletoEmitido: Boolean(d.boleto),
      boletoLink: d.boleto ? `https://demo.local/boleto/${d.id}.pdf` : null,
      linhaDigitavel: d.boleto
        ? `34191.79001 01043.510047 91020.150008 ${String(d.id).slice(-1)} 000${d.id}`
        : null,
      observacao: null,
    } satisfies Titulo;
  });
}

let titulos: Titulo[] | null = null;
let proximoId = 95000;

export function titulosDemo(): Titulo[] {
  if (!titulos) titulos = criarTitulos();
  return titulos;
}

function buscar(tituloId: number): Titulo {
  const titulo = titulosDemo().find((t) => t.id === tituloId);
  if (!titulo) throw new Error(`Título ${tituloId} não encontrado (modo demonstração).`);
  return titulo;
}

function recalcularStatus(titulo: Titulo) {
  if (titulo.status === "CANCELADO") return;
  if (titulo.saldo <= 0) {
    titulo.status = "RECEBIDO";
  } else if (titulo.valorRecebido > 0) {
    titulo.status = "PARCIAL";
  } else {
    titulo.status = titulo.vencimento < hoje() ? "VENCIDO" : "A_VENCER";
  }
}

export function lancarDescontoDemo(
  tituloId: number,
  desconto: number,
  contaCorrenteId: number,
) {
  const titulo = buscar(tituloId);
  titulo.valorDesconto = round2(titulo.valorDesconto + desconto);
  titulo.saldo = round2(titulo.saldo - desconto);
  const conta = CONTAS_CORRENTE_DEMO.find((c) => c.id === contaCorrenteId);
  if (conta) {
    titulo.contaCorrenteId = conta.id;
    titulo.contaCorrenteNome = conta.descricao;
  }
  recalcularStatus(titulo);
  return { codigo_lancamento_omie: tituloId, descricao: "Recebimento lançado (demonstração)" };
}

export function alterarContaDemo(tituloId: number, contaCorrenteId: number) {
  const titulo = buscar(tituloId);
  const conta = CONTAS_CORRENTE_DEMO.find((c) => c.id === contaCorrenteId);
  if (!conta) throw new Error("Conta corrente inexistente (modo demonstração).");
  titulo.contaCorrenteId = conta.id;
  titulo.contaCorrenteNome = conta.descricao;
  return { codigo_lancamento_omie: tituloId, descricao: "Conta corrente alterada (demonstração)" };
}

export function emitirBoletoDemo(tituloId: number) {
  const titulo = buscar(tituloId);
  titulo.boletoEmitido = true;
  titulo.boletoLink = `https://demo.local/boleto/${tituloId}.pdf`;
  titulo.linhaDigitavel = `34191.79001 01043.510047 91020.150008 ${String(tituloId).slice(-1)} 000${tituloId}`;
  return {
    cLinkBoleto: titulo.boletoLink,
    cCodBarras: titulo.linhaDigitavel,
    cCodStatus: "0",
    cMensagem: "Boleto emitido (demonstração)",
  };
}

export function incluirTituloDemo(dados: {
  clienteId: number;
  vencimento: string;
  valor: number;
  documento: string;
  parcela: string;
  contaCorrenteId: number | null;
  observacao?: string;
}) {
  const cliente = CLIENTES_DEMO.find((c) => c.id === dados.clienteId);
  const conta = CONTAS_CORRENTE_DEMO.find((c) => c.id === dados.contaCorrenteId);
  const id = proximoId++;
  const novo: Titulo = {
    id,
    numeroTitulo: String(id),
    numeroDocumento: dados.documento,
    parcela: dados.parcela,
    clienteId: dados.clienteId,
    clienteNome: cliente?.nome ?? `Cliente ${dados.clienteId}`,
    clienteCnpj: cliente?.cnpj ?? "",
    emissao: hoje(),
    vencimento: dados.vencimento,
    valorOriginal: dados.valor,
    valorRecebido: 0,
    valorDesconto: 0,
    saldo: dados.valor,
    status: dados.vencimento < hoje() ? "VENCIDO" : "A_VENCER",
    contaCorrenteId: conta?.id ?? null,
    contaCorrenteNome: conta?.descricao ?? null,
    boletoEmitido: false,
    boletoLink: null,
    linhaDigitavel: null,
    observacao: dados.observacao ?? null,
  };
  titulosDemo().push(novo);
  return { codigo_lancamento_omie: id, descricao: "Título incluído (demonstração)" };
}

export function excluirTituloDemo(tituloId: number) {
  const lista = titulosDemo();
  const indice = lista.findIndex((t) => t.id === tituloId);
  if (indice >= 0) lista.splice(indice, 1);
  return { codigo_lancamento_omie: tituloId, descricao: "Título excluído (demonstração)" };
}
