"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import {
  BarraProgresso,
  ResultadoLote,
  type ProgressoLote,
} from "@/components/ui/ResultadoLote";
import { calcularPrevia, contratoVigente, totalizarPrevias } from "@/lib/desconto";
import { dataBr, hoje, moeda, percentual } from "@/lib/format";
import { enviarSequencial, postJson } from "@/lib/lote";
import type { ItemDesconto } from "@/lib/operacoes-tipos";
import type {
  Config,
  ContaCorrente,
  Contrato,
  Perfil,
  ResultadoItem,
  Titulo,
} from "@/lib/types";

interface EntradaManual {
  incluir: boolean;
  valor: string;
  justificativa: string;
}

export function DescontoModal({
  titulos,
  contratos,
  contas,
  config,
  perfil,
  onFechar,
  onConcluido,
}: {
  titulos: Titulo[];
  contratos: Contrato[];
  contas: ContaCorrente[];
  config: Config;
  perfil: Perfil;
  onFechar: () => void;
  onConcluido: () => void;
}) {
  const [data, setData] = useState(hoje());
  const [contaCorrenteId, setContaCorrenteId] = useState<string>("");
  const [trocarConta, setTrocarConta] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [manuais, setManuais] = useState<Record<number, EntradaManual>>({});
  const [progresso, setProgresso] = useState<ProgressoLote | null>(null);
  const [resultados, setResultados] = useState<ResultadoItem[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const agrupados = useMemo(
    () =>
      titulos.map((titulo) => ({
        titulo,
        contrato: contratoVigente(contratos, titulo.clienteId, data),
      })),
    [titulos, contratos, data],
  );

  const previasContrato = useMemo(
    () =>
      agrupados
        .filter((g) => g.contrato)
        .map((g) => calcularPrevia(g.titulo, g.contrato, { pisoSaldo: config.pisoSaldo })),
    [agrupados, config.pisoSaldo],
  );

  const semContrato = useMemo(() => agrupados.filter((g) => !g.contrato), [agrupados]);

  const previasManuais = useMemo(
    () =>
      semContrato
        .filter((g) => manuais[g.titulo.id]?.incluir)
        .map((g) =>
          calcularPrevia(g.titulo, null, {
            pisoSaldo: config.pisoSaldo,
            valorManual: Number(
              (manuais[g.titulo.id]?.valor ?? "0").replace(",", "."),
            ),
          }),
        ),
    [semContrato, manuais, config.pisoSaldo],
  );

  const totais = useMemo(
    () => totalizarPrevias([...previasContrato, ...previasManuais]),
    [previasContrato, previasManuais],
  );

  const itens = useMemo<ItemDesconto[]>(() => {
    const doContrato = previasContrato
      .filter((p) => !p.bloqueio)
      .map((p) => montarItem(titulos, p.tituloId));

    const dosManuais = previasManuais
      .filter((p) => !p.bloqueio)
      .map((p) => ({
        ...montarItem(titulos, p.tituloId),
        valorManual: Number((manuais[p.tituloId]?.valor ?? "0").replace(",", ".")),
        justificativa: manuais[p.tituloId]?.justificativa ?? "",
      }));

    return [...doContrato, ...dosManuais];
  }, [previasContrato, previasManuais, titulos, manuais]);

  const executando = progresso !== null && progresso.atual < progresso.total;

  async function aplicar() {
    setErro(null);
    if (!itens.length) {
      setErro("Nenhum título elegível para desconto na seleção atual.");
      return;
    }

    setResultados([]);
    setProgresso({ atual: 0, total: itens.length });

    const finais = await enviarSequencial(
      itens,
      (item) => item.tituloId,
      async (item) => {
        const resposta = await postJson<{ resultados: ResultadoItem[] }>(
          "/api/descontos",
          {
            itens: [item],
            data,
            contaCorrenteId: contaCorrenteId ? Number(contaCorrenteId) : null,
            trocarConta: trocarConta && Boolean(contaCorrenteId),
            observacao: observacao.trim() || undefined,
          },
        );
        return resposta.resultados;
      },
      (concluidos) => setProgresso({ atual: concluidos, total: itens.length }),
    );

    setResultados(finais);
    onConcluido();
  }

  const concluido = resultados.length > 0 && !executando;

  return (
    <Modal
      titulo="Aplicar desconto de contrato"
      descricao="O desconto é lançado como um recebimento de valor zero na conta corrente escolhida: o saldo do título cai apenas o valor do desconto e o restante continua a receber."
      largura="max-w-5xl"
      onFechar={onFechar}
      rodape={
        concluido ? (
          <button className="btn-primario" onClick={onFechar}>
            Fechar
          </button>
        ) : (
          <>
            <span className="mr-auto text-sm text-suave">
              {totais.quantidade} título(s) · desconto {moeda(totais.desconto)} · restará{" "}
              {moeda(totais.saldoFinal)}
            </span>
            <button className="btn" onClick={onFechar} disabled={executando}>
              Cancelar
            </button>
            <button className="btn-primario" onClick={aplicar} disabled={executando}>
              {executando ? "Gravando no Omie…" : "Confirmar e gravar no Omie"}
            </button>
          </>
        )
      }
    >
      {progresso && executando && <BarraProgresso progresso={progresso} />}

      {concluido ? (
        <ResultadoLote resultados={resultados} />
      ) : (
        <>
          <div className="mb-5 grid gap-3 md:grid-cols-3">
            <div>
              <label className="rotulo" htmlFor="data-recebimento">
                Data do recebimento
              </label>
              <input
                id="data-recebimento"
                type="date"
                className="campo"
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </div>
            <div>
              <label className="rotulo" htmlFor="conta-recebimento">
                Conta corrente do lançamento
              </label>
              <select
                id="conta-recebimento"
                className="campo"
                value={contaCorrenteId}
                onChange={(e) => setContaCorrenteId(e.target.value)}
              >
                <option value="">Usar a conta do título / do contrato</option>
                {contas.map((conta) => (
                  <option key={conta.id} value={conta.id}>
                    {conta.descricao}
                    {conta.banco ? ` — ${conta.banco}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={trocarConta}
                  disabled={!contaCorrenteId}
                  onChange={(e) => setTrocarConta(e.target.checked)}
                />
                Também trocar a conta corrente do título
              </label>
            </div>
          </div>

          <div className="mb-5">
            <label className="rotulo" htmlFor="obs-desconto">
              Observação do recebimento (opcional)
            </label>
            <input
              id="obs-desconto"
              className="campo"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: desconto de contrato referente à campanha de julho"
            />
          </div>

          <h3 className="mb-2 text-sm font-semibold">
            Clientes especiais ({previasContrato.length})
          </h3>
          {previasContrato.length === 0 ? (
            <p className="mb-5 rounded-lg bg-cartao-alt px-3 py-2 text-sm text-suave">
              Nenhum título da seleção pertence a cliente com contrato vigente.
            </p>
          ) : (
            <div className="mb-6 overflow-x-auto">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Documento</th>
                    <th>Vencimento</th>
                    <th className="num">Saldo atual</th>
                    <th className="num">%</th>
                    <th className="num">Desconto</th>
                    <th className="num">Restará</th>
                  </tr>
                </thead>
                <tbody>
                  {previasContrato.map((previa) => (
                    <tr key={previa.tituloId}>
                      <td>
                        <div className="font-medium">{previa.clienteNome}</div>
                        {(previa.aviso || previa.bloqueio) && (
                          <div
                            className={`text-xs ${
                              previa.bloqueio ? "text-negativo" : "text-alerta"
                            }`}
                          >
                            {previa.bloqueio ?? previa.aviso}
                          </div>
                        )}
                      </td>
                      <td>{previa.documento}</td>
                      <td>{dataBr(previa.vencimento)}</td>
                      <td className="num">{moeda(previa.saldoAtual)}</td>
                      <td className="num">{percentual(previa.percentual)}</td>
                      <td className="num font-medium text-acento">
                        {moeda(previa.valorDesconto)}
                      </td>
                      <td className="num">{moeda(previa.saldoFinal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-medium">
                    <td colSpan={3}>Total</td>
                    <td className="num">{moeda(totais.saldoOriginal)}</td>
                    <td />
                    <td className="num text-acento">{moeda(totais.desconto)}</td>
                    <td className="num">{moeda(totais.saldoFinal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {semContrato.length > 0 && (
            <>
              <h3 className="mb-1 text-sm font-semibold">
                Sem desconto de contrato ({semContrato.length})
              </h3>
              <p className="mb-2 text-xs text-suave">
                Para lançar desconto nestes títulos informe o valor e a justificativa.
                {perfil !== "gestor" &&
                  ` Valores acima de ${moeda(config.limiteDescontoManual)} exigem um gestor.`}
              </p>
              <div className="mb-2 space-y-2">
                {semContrato.map(({ titulo }) => {
                  const entrada = manuais[titulo.id] ?? {
                    incluir: false,
                    valor: "",
                    justificativa: "",
                  };
                  return (
                    <div
                      key={titulo.id}
                      className="rounded-lg border border-borda bg-cartao-alt px-3 py-2"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="flex items-center gap-2 text-sm font-medium">
                          <input
                            type="checkbox"
                            checked={entrada.incluir}
                            onChange={(e) =>
                              setManuais((atual) => ({
                                ...atual,
                                [titulo.id]: { ...entrada, incluir: e.target.checked },
                              }))
                            }
                          />
                          {titulo.clienteNome}
                        </label>
                        <span className="text-xs text-suave">
                          {titulo.numeroDocumento} · venc. {dataBr(titulo.vencimento)} · saldo{" "}
                          {moeda(titulo.saldo)}
                        </span>
                      </div>

                      {entrada.incluir && (
                        <div className="mt-2 grid gap-2 md:grid-cols-[160px_1fr]">
                          <input
                            className="campo-num"
                            inputMode="decimal"
                            placeholder="Desconto R$"
                            value={entrada.valor}
                            onChange={(e) =>
                              setManuais((atual) => ({
                                ...atual,
                                [titulo.id]: { ...entrada, valor: e.target.value },
                              }))
                            }
                          />
                          <input
                            className="campo"
                            placeholder="Justificativa (obrigatória)"
                            value={entrada.justificativa}
                            onChange={(e) =>
                              setManuais((atual) => ({
                                ...atual,
                                [titulo.id]: { ...entrada, justificativa: e.target.value },
                              }))
                            }
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {erro && (
            <p className="mt-3 rounded-lg bg-negativo-suave px-3 py-2 text-sm text-negativo">
              {erro}
            </p>
          )}
        </>
      )}
    </Modal>
  );
}

function montarItem(titulos: Titulo[], tituloId: number): ItemDesconto {
  const titulo = titulos.find((t) => t.id === tituloId)!;
  return {
    tituloId: titulo.id,
    clienteId: titulo.clienteId,
    clienteNome: titulo.clienteNome,
    documento: titulo.numeroDocumento,
    saldo: titulo.saldo,
    valorOriginal: titulo.valorOriginal,
    vencimento: titulo.vencimento,
    boletoEmitido: titulo.boletoEmitido,
    contaCorrenteTituloId: titulo.contaCorrenteId,
  };
}
