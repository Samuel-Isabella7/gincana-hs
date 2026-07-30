import "server-only";
import type { Sessao } from "./auth";
import { NaoAutorizado } from "./auth";
import { calcularPrevia, contratoVigente } from "./desconto";
import { floor2, hoje, round2 } from "./format";
import { mensagemErro } from "./omie/client";
import { titulosDemo } from "./omie/mock";
import {
  alterarContaCorrente,
  consultarTitulo,
  emitirBoleto,
  excluirTitulo,
  incluirTitulo,
  lancarDescontoRecebimento,
  modoDemonstracao,
} from "./omie/service";
import type {
  EntradaDescontos,
  EntradaParcelamento,
  ResultadoParcelamento,
} from "./operacoes-tipos";
import { gerarParcelas, MAX_PARCELAS, MIN_PARCELAS } from "./parcelamento";
import { lerConfig, listarContratos, registrarEvento } from "./store";
import type { ResultadoItem, Titulo } from "./types";

export type {
  EntradaDescontos,
  EntradaParcelamento,
  ItemDesconto,
  ResultadoParcelamento,
} from "./operacoes-tipos";

/** No modo demonstração conhecemos o saldo real; no Omie usamos o saldo enviado pela tela. */
function saldoConfiavel(tituloId: number, saldoInformado: number): number {
  if (!modoDemonstracao()) return round2(saldoInformado);
  const titulo = titulosDemo().find((t) => t.id === tituloId);
  return round2(titulo?.saldo ?? saldoInformado);
}

// ------------------------------------------------------------------- descontos

export async function aplicarDescontos(
  sessao: Sessao,
  entrada: EntradaDescontos,
): Promise<ResultadoItem[]> {
  if (!entrada.itens?.length) return [];

  const [config, contratos] = await Promise.all([lerConfig(), listarContratos()]);
  const data = entrada.data || hoje();
  const resultados: ResultadoItem[] = [];

  for (const item of entrada.itens) {
    const contrato = contratoVigente(contratos, item.clienteId, data);
    const saldo = saldoConfiavel(item.tituloId, item.saldo);

    const titulo: Titulo = {
      id: item.tituloId,
      numeroTitulo: String(item.tituloId),
      numeroDocumento: item.documento ?? "",
      parcela: "",
      clienteId: item.clienteId,
      clienteNome: item.clienteNome ?? "",
      clienteCnpj: "",
      emissao: "",
      vencimento: item.vencimento ?? "",
      valorOriginal: item.valorOriginal ?? saldo,
      valorRecebido: 0,
      valorDesconto: 0,
      saldo,
      status: saldo > 0 ? "A_VENCER" : "RECEBIDO",
      contaCorrenteId: item.contaCorrenteTituloId ?? null,
      contaCorrenteNome: null,
      boletoEmitido: Boolean(item.boletoEmitido),
      boletoLink: null,
      linhaDigitavel: null,
      observacao: null,
    };

    const previa = calcularPrevia(titulo, contrato, {
      pisoSaldo: config.pisoSaldo,
      percentualManual: item.percentualManual,
      valorManual: item.valorManual,
    });

    if (previa.bloqueio) {
      resultados.push({ tituloId: item.tituloId, sucesso: false, mensagem: previa.bloqueio });
      continue;
    }

    // Desconto manual acima do limite só pode ser lançado por gestor.
    if (previa.origem === "manual") {
      if (!item.justificativa?.trim()) {
        resultados.push({
          tituloId: item.tituloId,
          sucesso: false,
          mensagem: "Desconto manual exige justificativa.",
        });
        continue;
      }
      if (
        previa.valorDesconto > config.limiteDescontoManual &&
        sessao.perfil !== "gestor"
      ) {
        resultados.push({
          tituloId: item.tituloId,
          sucesso: false,
          mensagem: `Desconto manual acima de R$ ${config.limiteDescontoManual.toFixed(
            2,
          )} exige aprovação de um gestor.`,
        });
        continue;
      }
    }

    const contaLancamento =
      entrada.contaCorrenteId ??
      contrato?.contaCorrentePreferencial ??
      item.contaCorrenteTituloId ??
      config.contaCorrentePadrao;

    if (!contaLancamento) {
      resultados.push({
        tituloId: item.tituloId,
        sucesso: false,
        mensagem:
          "Título sem conta corrente. Escolha a conta no modal ou defina uma conta padrão em Configurações.",
      });
      continue;
    }

    const observacao =
      entrada.observacao?.trim() ||
      (previa.origem === "contrato"
        ? `Desconto de contrato ${previa.percentual.toFixed(2)}% aplicado via sistema.`
        : `Desconto manual: ${item.justificativa?.trim()}`);

    try {
      const { param, resposta } = await lancarDescontoRecebimento({
        tituloId: item.tituloId,
        desconto: previa.valorDesconto,
        contaCorrenteId: contaLancamento,
        data,
        observacao,
      });

      let mensagem = `Desconto de R$ ${previa.valorDesconto.toFixed(
        2,
      )} lançado. Restam R$ ${previa.saldoFinal.toFixed(2)} a receber.`;

      if (entrada.trocarConta && entrada.contaCorrenteId) {
        await alterarContaCorrente(item.tituloId, entrada.contaCorrenteId);
        mensagem += " Conta corrente do título atualizada.";
      }

      await registrarEvento({
        usuario: sessao.usuario,
        acao: "desconto",
        entidade: `titulo:${item.tituloId}`,
        descricao: `${previa.origem === "contrato" ? "Desconto de contrato" : "Desconto manual"} de R$ ${previa.valorDesconto.toFixed(2)} em ${item.clienteNome ?? item.clienteId} (saldo ${saldo.toFixed(2)} -> ${previa.saldoFinal.toFixed(2)})`,
        payloadEnviado: param,
        respostaOmie: resposta,
        sucesso: true,
        erro: null,
      });

      resultados.push({
        tituloId: item.tituloId,
        sucesso: true,
        mensagem,
        detalhe: { desconto: previa.valorDesconto, saldoFinal: previa.saldoFinal },
      });
    } catch (erro) {
      const mensagem = mensagemErro(erro);
      await registrarEvento({
        usuario: sessao.usuario,
        acao: "desconto",
        entidade: `titulo:${item.tituloId}`,
        descricao: `Falha ao lançar desconto de R$ ${previa.valorDesconto.toFixed(2)}`,
        payloadEnviado: { tituloId: item.tituloId, desconto: previa.valorDesconto, contaLancamento },
        respostaOmie: null,
        sucesso: false,
        erro: mensagem,
      });
      resultados.push({ tituloId: item.tituloId, sucesso: false, mensagem });
    }
  }

  return resultados;
}

// ------------------------------------------------------------ conta corrente

export async function trocarContaCorrente(
  sessao: Sessao,
  tituloIds: number[],
  contaCorrenteId: number,
): Promise<ResultadoItem[]> {
  const resultados: ResultadoItem[] = [];

  for (const tituloId of tituloIds) {
    try {
      const { param, resposta } = await alterarContaCorrente(tituloId, contaCorrenteId);
      await registrarEvento({
        usuario: sessao.usuario,
        acao: "conta_corrente",
        entidade: `titulo:${tituloId}`,
        descricao: `Conta corrente do título alterada para ${contaCorrenteId}`,
        payloadEnviado: param,
        respostaOmie: resposta,
        sucesso: true,
        erro: null,
      });
      resultados.push({
        tituloId,
        sucesso: true,
        mensagem: "Conta corrente atualizada no título.",
      });
    } catch (erro) {
      const mensagem = mensagemErro(erro);
      await registrarEvento({
        usuario: sessao.usuario,
        acao: "conta_corrente",
        entidade: `titulo:${tituloId}`,
        descricao: "Falha ao alterar conta corrente do título",
        payloadEnviado: { tituloId, contaCorrenteId },
        respostaOmie: null,
        sucesso: false,
        erro: mensagem,
      });
      resultados.push({ tituloId, sucesso: false, mensagem });
    }
  }

  return resultados;
}

// ---------------------------------------------------------------------- boleto

export async function emitirBoletos(
  sessao: Sessao,
  tituloIds: number[],
): Promise<ResultadoItem[]> {
  const resultados: ResultadoItem[] = [];

  for (const tituloId of tituloIds) {
    try {
      const { param, boleto } = await emitirBoleto(tituloId);
      await registrarEvento({
        usuario: sessao.usuario,
        acao: "boleto",
        entidade: `titulo:${tituloId}`,
        descricao: "Boleto emitido pelo Omie",
        payloadEnviado: param,
        respostaOmie: boleto,
        sucesso: true,
        erro: null,
      });
      resultados.push({
        tituloId,
        sucesso: true,
        mensagem: boleto.mensagem ?? "Boleto emitido.",
        detalhe: boleto,
      });
    } catch (erro) {
      const mensagem = mensagemErro(erro);
      await registrarEvento({
        usuario: sessao.usuario,
        acao: "boleto",
        entidade: `titulo:${tituloId}`,
        descricao: "Falha ao emitir boleto",
        payloadEnviado: { tituloId },
        respostaOmie: null,
        sucesso: false,
        erro: mensagem,
      });
      resultados.push({ tituloId, sucesso: false, mensagem });
    }
  }

  return resultados;
}

// ----------------------------------------------------------------- parcelamento

export async function parcelarTitulo(
  sessao: Sessao,
  entrada: EntradaParcelamento,
): Promise<ResultadoParcelamento> {
  if (entrada.quantidade < MIN_PARCELAS || entrada.quantidade > MAX_PARCELAS) {
    throw new Error(`Quantidade de parcelas deve estar entre ${MIN_PARCELAS} e ${MAX_PARCELAS}.`);
  }

  const saldo = saldoConfiavel(entrada.tituloId, entrada.saldo);
  const original = await consultarTitulo(entrada.tituloId);
  const parcelas = gerarParcelas({
    total: saldo,
    quantidade: entrada.quantidade,
    primeiroVencimento: entrada.primeiroVencimento,
    intervaloDias: entrada.intervaloDias,
    acrescimoPercentual: entrada.acrescimoPercentual,
    datas: entrada.datas,
  });

  const documento =
    entrada.documento || (original.numero_documento_fiscal as string) || String(entrada.tituloId);
  const contaCorrente =
    entrada.contaCorrenteId ?? (original.id_conta_corrente as number | undefined) ?? null;

  const resultado: ResultadoParcelamento = {
    parcelas: [],
    originalExcluido: false,
    mensagemOriginal: null,
  };

  for (const parcela of parcelas) {
    const numeroParcela = `${String(parcela.numero).padStart(3, "0")}/${String(
      entrada.quantidade,
    ).padStart(3, "0")}`;

    try {
      const { param, resposta } = await incluirTitulo({
        clienteId: entrada.clienteId || Number(original.codigo_cliente_fornecedor ?? 0),
        vencimento: parcela.vencimento,
        valor: parcela.valor,
        documento,
        parcela: numeroParcela,
        contaCorrenteId: contaCorrente,
        categoria: original.codigo_categoria,
        observacao: `Parcelamento do título ${entrada.tituloId} (${numeroParcela}).`,
      });

      const novoId =
        (resposta as { codigo_lancamento_omie?: number } | null)?.codigo_lancamento_omie ?? null;

      let boleto: { link: string | null; linhaDigitavel: string | null } | null = null;
      let mensagem = "Parcela criada no Omie.";

      if (entrada.emitirBoletos && novoId) {
        try {
          const emitido = await emitirBoleto(novoId);
          boleto = {
            link: emitido.boleto.link,
            linhaDigitavel: emitido.boleto.linhaDigitavel,
          };
          mensagem += " Boleto emitido.";
        } catch (erro) {
          mensagem += ` Falha ao emitir boleto: ${mensagemErro(erro)}`;
        }
      }

      await registrarEvento({
        usuario: sessao.usuario,
        acao: "parcelamento",
        entidade: `titulo:${entrada.tituloId}`,
        descricao: `Parcela ${numeroParcela} de R$ ${parcela.valor.toFixed(2)} criada (venc. ${parcela.vencimento})`,
        payloadEnviado: param,
        respostaOmie: resposta,
        sucesso: true,
        erro: null,
      });

      resultado.parcelas.push({
        ...parcela,
        tituloId: novoId,
        sucesso: true,
        mensagem,
        boleto,
      });
    } catch (erro) {
      const mensagem = mensagemErro(erro);
      await registrarEvento({
        usuario: sessao.usuario,
        acao: "parcelamento",
        entidade: `titulo:${entrada.tituloId}`,
        descricao: `Falha ao criar parcela ${numeroParcela}`,
        payloadEnviado: { parcela, entrada },
        respostaOmie: null,
        sucesso: false,
        erro: mensagem,
      });
      resultado.parcelas.push({ ...parcela, tituloId: null, sucesso: false, mensagem });
    }
  }

  const todasCriadas = resultado.parcelas.every((p) => p.sucesso);

  if (entrada.excluirOriginal) {
    if (!todasCriadas) {
      resultado.mensagemOriginal =
        "Título original mantido: alguma parcela falhou. Corrija as falhas antes de excluir.";
    } else {
      try {
        const { param, resposta } = await excluirTitulo(entrada.tituloId);
        resultado.originalExcluido = true;
        resultado.mensagemOriginal = "Título original excluído do Omie.";
        await registrarEvento({
          usuario: sessao.usuario,
          acao: "parcelamento",
          entidade: `titulo:${entrada.tituloId}`,
          descricao: "Título original excluído após o parcelamento",
          payloadEnviado: param,
          respostaOmie: resposta,
          sucesso: true,
          erro: null,
        });
      } catch (erro) {
        resultado.mensagemOriginal = `Parcelas criadas, mas o título original não pôde ser excluído: ${mensagemErro(erro)}`;
        await registrarEvento({
          usuario: sessao.usuario,
          acao: "parcelamento",
          entidade: `titulo:${entrada.tituloId}`,
          descricao: "Falha ao excluir título original após o parcelamento",
          payloadEnviado: { tituloId: entrada.tituloId },
          respostaOmie: null,
          sucesso: false,
          erro: mensagemErro(erro),
        });
      }
    }
  }

  return resultado;
}

export function garantirGestor(sessao: Sessao) {
  if (sessao.perfil !== "gestor") {
    throw new NaoAutorizado("Esta operação exige perfil gestor.");
  }
}

export const utilitarios = { floor2, round2 };
