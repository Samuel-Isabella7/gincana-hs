"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import {
  BarraProgresso,
  ResultadoLote,
  type ProgressoLote,
} from "@/components/ui/ResultadoLote";
import {
  calcularPrevia,
  contratoVigente,
  escolherRegra,
  totalizarPrevias,
} from "@/lib/desconto";
import { dataBr, hoje, moeda, percentual } from "@/lib/format";
import { enviarSequencial, postJson } from "@/lib/lote";
import type { ItemDesconto } from "@/lib/operacoes-tipos";
import type {
  CategoriaProduto,
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

type Fase = "previa" | "processando" | "resultado";

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
  onConcluido: (mensagem?: string) => void;
}) {
  const [fase, setFase] = useState<Fase>("previa");
  const [data, setData] = useState(hoje());
  const [contaCorrenteId, setContaCorrenteId] = useState<string>("");
  const [trocarConta, setTrocarConta] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [manuais, setManuais] = useState<Record<number, EntradaManual>>({});
  const [ignorados, setIgnorados] = useState<number[]>([]);
  /** Faixa do contrato escolhida por título (secos/congelados/praça). */
  const [regras, setRegras] = useState<Record<number, string>>({});
  const [progresso, setProgresso] = useState<ProgressoLote>({ atual: 0, total: 0 });
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

  const comContrato = useMemo(() => agrupados.filter((g) => g.contrato), [agrupados]);

  const previasContrato = useMemo(
    () =>
      comContrato.map((g) =>
        calcularPrevia(g.titulo, g.contrato, {
          pisoSaldo: config.pisoSaldo,
          regraId: regras[g.titulo.id],
        }),
      ),
    [comContrato, config.pisoSaldo, regras],
  );

  /** Define a faixa de todos os títulos cujo contrato tem essa categoria. */
  function aplicarCategoriaEmTodos(categoria: CategoriaProduto) {
    setRegras((atual) => {
      const proximo = { ...atual };
      for (const { titulo, contrato } of comContrato) {
        const regra =
          contrato!.regras.find((r) => r.categoria === categoria) ??
          escolherRegra(contrato);
        if (regra) proximo[titulo.id] = regra.id;
      }
      return proximo;
    });
  }

  const categoriasDisponiveis = useMemo(() => {
    const conjunto = new Set<CategoriaProduto>();
    for (const { contrato } of comContrato) {
      for (const regra of contrato!.regras) conjunto.add(regra.categoria);
    }
    return [...conjunto];
  }, [comContrato]);

  const precisaEscolha = previasContrato.some(
    (p) => p.bloqueio?.startsWith("Escolha a faixa"),
  );

  const semContrato = useMemo(() => agrupados.filter((g) => !g.contrato), [agrupados]);

  const previasManuais = useMemo(
    () =>
      semContrato
        .filter((g) => manuais[g.titulo.id]?.incluir)
        .map((g) =>
          calcularPrevia(g.titulo, null, {
            pisoSaldo: config.pisoSaldo,
            valorManual: Number((manuais[g.titulo.id]?.valor ?? "0").replace(",", ".")),
          }),
        ),
    [semContrato, manuais, config.pisoSaldo],
  );

  const previasAtivas = useMemo(
    () => previasContrato.filter((p) => !ignorados.includes(p.tituloId)),
    [previasContrato, ignorados],
  );

  const totais = useMemo(
    () => totalizarPrevias([...previasAtivas, ...previasManuais]),
    [previasAtivas, previasManuais],
  );

  const itens = useMemo<ItemDesconto[]>(() => {
    const doContrato = previasAtivas
      .filter((p) => !p.bloqueio)
      .map((p) => ({
        ...montarItem(titulos, p.tituloId),
        regraId: p.regraId ?? undefined,
      }));

    const dosManuais = previasManuais
      .filter((p) => !p.bloqueio)
      .map((p) => ({
        ...montarItem(titulos, p.tituloId),
        valorManual: Number((manuais[p.tituloId]?.valor ?? "0").replace(",", ".")),
        justificativa: manuais[p.tituloId]?.justificativa ?? "",
      }));

    return [...doContrato, ...dosManuais];
  }, [previasAtivas, previasManuais, titulos, manuais]);

  async function executar(lista: ItemDesconto[]) {
    if (!lista.length) {
      setErro("Nenhum título elegível para desconto na seleção atual.");
      return;
    }

    setErro(null);
    setResultados([]);
    setFase("processando");
    setProgresso({ atual: 0, total: lista.length });

    const finais = await enviarSequencial(
      lista,
      (item) => item.tituloId,
      async (item) => {
        setProgresso((atual) => ({
          ...atual,
          descricao: `Gravando no Omie — ${item.clienteNome ?? item.tituloId}`,
          rota: "financas/contareceber · LancarRecebimento",
        }));
        const resposta = await postJson<{ resultados: ResultadoItem[] }>("/api/descontos", {
          itens: [item],
          data,
          contaCorrenteId: contaCorrenteId ? Number(contaCorrenteId) : null,
          trocarConta: trocarConta && Boolean(contaCorrenteId),
          observacao: observacao.trim() || undefined,
        });
        return resposta.resultados;
      },
      (concluidos) =>
        setProgresso((atual) => ({ ...atual, atual: concluidos, total: lista.length })),
    );

    setResultados(finais);
    setFase("resultado");

    const ok = finais.filter((r) => r.sucesso && !r.pendente).length;
    const falhas = finais.filter((r) => !r.sucesso).length;
    onConcluido(
      falhas
        ? `${ok} desconto(s) gravado(s), ${falhas} com falha.`
        : `${ok} desconto(s) gravado(s) no Omie.`,
    );
  }

  const falhas = resultados.filter((r) => !r.sucesso);

  function reprocessarFalhas() {
    const ids = falhas.map((f) => f.tituloId);
    void executar(itens.filter((item) => ids.includes(item.tituloId)));
  }

  return (
    <Modal
      titulo="Aplicar desconto de contrato"
      descricao={
        fase === "previa"
          ? "Pré-visualização — nada é gravado no Omie até você confirmar."
          : "Recebimento de valor zero com o valor no campo Desconto: o título não é quitado."
      }
      onFechar={onFechar}
      rodape={
        fase === "resultado" ? (
          <>
            {falhas.length > 0 && (
              <button className="btn btn-modal mr-auto" onClick={reprocessarFalhas}>
                Reprocessar somente as falhas ({falhas.length})
              </button>
            )}
            <button className="btn-primario btn-modal ml-auto" onClick={onFechar}>
              Fechar
            </button>
          </>
        ) : (
          <>
            <span className="mono mr-auto text-[12px] text-suave">
              saldo {moeda(totais.saldoOriginal)} · desconto{" "}
              <span className="text-negativo">−{moeda(totais.desconto)}</span> · restará{" "}
              <span className="font-semibold">{moeda(totais.saldoFinal)}</span>
            </span>
            <button
              className="btn btn-modal"
              onClick={onFechar}
              disabled={fase === "processando"}
            >
              Cancelar
            </button>
            <button
              className="btn-primario btn-modal"
              onClick={() => executar(itens)}
              disabled={fase === "processando"}
            >
              {fase === "processando" ? "Gravando no Omie…" : "Confirmar e gravar no Omie"}
            </button>
          </>
        )
      }
    >
      {fase === "processando" && <BarraProgresso progresso={progresso} />}

      {fase === "resultado" && (
        <ResultadoLote resultados={resultados} />
      )}

      {fase === "previa" && (
        <>
          <div className="mb-4 grid gap-3 md:grid-cols-3">
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
            <div className="flex flex-col justify-end">
              <label className="flex h-[30px] items-center gap-1.5 text-[12.5px]">
                <input
                  type="checkbox"
                  checked={trocarConta}
                  disabled={!contaCorrenteId}
                  onChange={(e) => setTrocarConta(e.target.checked)}
                />
                Também trocar a conta corrente do título
              </label>
              <span className="mono text-[10.5px] text-fraco">AlterarContaReceber</span>
            </div>
          </div>

          <div className="mb-4">
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

          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <p className="eyebrow">
              Com contrato cadastrado — {previasContrato.length} título(s)
            </p>
            {categoriasDisponiveis.length > 1 && (
              <div className="ml-auto flex items-center gap-1.5">
                <span className="text-[11px] text-fraco">aplicar a todos:</span>
                {categoriasDisponiveis.map((categoria) => (
                  <button
                    key={categoria}
                    className="btn-mini"
                    onClick={() => aplicarCategoriaEmTodos(categoria)}
                  >
                    {categoria}
                  </button>
                ))}
              </div>
            )}
          </div>

          {precisaEscolha && (
            <p className="aviso aviso-alerta mb-2">
              Alguns clientes têm mais de uma faixa (secos/congelados ou praça). Escolha a
              faixa na coluna correspondente antes de gravar.
            </p>
          )}
          {previasContrato.length === 0 ? (
            <p className="aviso aviso-alerta mb-5">
              Nenhum título da seleção pertence a cliente com contrato vigente.
            </p>
          ) : (
            <div className="cartao mb-5 overflow-hidden">
              <table className="tabela">
                <thead>
                  <tr>
                    <th className="w-9 pl-3" />
                    <th>Cliente</th>
                    <th>Documento</th>
                    <th>Faixa</th>
                    <th className="text-right">Saldo atual</th>
                    <th className="text-right">% contrato</th>
                    <th className="text-right">Desconto</th>
                    <th className="text-right">Restará</th>
                  </tr>
                </thead>
                <tbody>
                  {previasContrato.map((previa) => {
                    const marcado = !ignorados.includes(previa.tituloId) && !previa.bloqueio;
                    const contrato = comContrato.find(
                      (g) => g.titulo.id === previa.tituloId,
                    )?.contrato;
                    const opcoes = contrato?.regras ?? [];
                    return (
                      <tr key={previa.tituloId} className={marcado ? "selecionada" : undefined}>
                        <td className="pl-3">
                          <input
                            type="checkbox"
                            checked={marcado}
                            disabled={Boolean(previa.bloqueio)}
                            onChange={() =>
                              setIgnorados((atual) =>
                                atual.includes(previa.tituloId)
                                  ? atual.filter((id) => id !== previa.tituloId)
                                  : [...atual, previa.tituloId],
                              )
                            }
                            aria-label={`Incluir título ${previa.tituloId}`}
                          />
                        </td>
                        <td>
                          <div className="font-medium">{previa.clienteNome}</div>
                          {(previa.aviso || previa.bloqueio) && (
                            <div
                              className={`text-[11px] ${
                                previa.bloqueio ? "text-negativo" : "text-alerta"
                              }`}
                            >
                              {previa.bloqueio ?? previa.aviso}
                            </div>
                          )}
                        </td>
                        <td className="mono text-[12px]">
                          {previa.documento}
                          <span className="block text-[10.5px] text-fraco">
                            venc. {dataBr(previa.vencimento)}
                          </span>
                        </td>
                        <td>
                          {opcoes.length > 1 ? (
                            <select
                              className="campo w-[150px]"
                              value={previa.regraId ?? ""}
                              onChange={(e) =>
                                setRegras((atual) => ({
                                  ...atual,
                                  [previa.tituloId]: e.target.value,
                                }))
                              }
                            >
                              <option value="">escolher…</option>
                              {opcoes.map((regra) => (
                                <option key={regra.id} value={regra.id}>
                                  {regra.rotulo} · {percentual(regra.percentual)}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-[11.5px] text-suave">
                              {previa.regraRotulo ?? "—"}
                            </span>
                          )}
                        </td>
                        <td className="num">{moeda(previa.saldoAtual)}</td>
                        <td className="num font-semibold text-positivo">
                          {percentual(previa.percentual)}
                        </td>
                        <td className="num text-negativo">−{moeda(previa.valorDesconto)}</td>
                        <td className="num font-semibold">{moeda(previa.saldoFinal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4}>Total</td>
                    <td className="num">{moeda(totais.saldoOriginal)}</td>
                    <td />
                    <td className="num text-negativo">−{moeda(totais.desconto)}</td>
                    <td className="num">{moeda(totais.saldoFinal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {semContrato.length > 0 && (
            <div className="rounded-lg border border-dashed border-borda p-3">
              <p className="eyebrow mb-1">
                Sem desconto de contrato — {semContrato.length} título(s)
              </p>
              <p className="aviso aviso-alerta mb-2.5">
                Desconto manual acima de {moeda(config.limiteDescontoManual)}
                {perfil === "gestor"
                  ? " é lançado direto por você (perfil gestor)."
                  : " vai para a fila de aprovação do gestor."}{" "}
                A justificativa é obrigatória.
              </p>

              <div className="flex flex-col gap-1.5">
                {semContrato.map(({ titulo }) => {
                  const entrada = manuais[titulo.id] ?? {
                    incluir: false,
                    valor: "",
                    justificativa: "",
                  };
                  return (
                    <div
                      key={titulo.id}
                      className="rounded-md border border-borda bg-cartao-alt px-2.5 py-2"
                    >
                      <div className="flex flex-wrap items-center gap-2.5">
                        <label className="flex items-center gap-1.5 text-[12.5px] font-medium">
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
                        <span className="mono text-[11px] text-fraco">
                          {titulo.numeroDocumento} · venc. {dataBr(titulo.vencimento)} · saldo{" "}
                          {moeda(titulo.saldo)}
                        </span>
                      </div>

                      {entrada.incluir && (
                        <div className="mt-2 grid gap-2 md:grid-cols-[150px_1fr]">
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
            </div>
          )}

          {erro && <p className="aviso aviso-erro mt-3">{erro}</p>}
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
