"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { dataBr, moeda, somarDias } from "@/lib/format";
import { postJson } from "@/lib/lote";
import type { ResultadoParcelamento } from "@/lib/operacoes-tipos";
import { gerarParcelas, MAX_PARCELAS, MIN_PARCELAS, somarParcelas } from "@/lib/parcelamento";
import type { ContaCorrente, Titulo } from "@/lib/types";

export function ParcelamentoModal({
  titulo,
  contas,
  onFechar,
  onConcluido,
}: {
  titulo: Titulo;
  contas: ContaCorrente[];
  onFechar: () => void;
  onConcluido: () => void;
}) {
  const [quantidade, setQuantidade] = useState(2);
  const [primeiroVencimento, setPrimeiroVencimento] = useState(
    somarDias(titulo.vencimento || new Date().toISOString().slice(0, 10), 30),
  );
  const [intervaloDias, setIntervaloDias] = useState(30);
  const [acrescimo, setAcrescimo] = useState("0");
  const [contaId, setContaId] = useState(
    titulo.contaCorrenteId ? String(titulo.contaCorrenteId) : "",
  );
  const [excluirOriginal, setExcluirOriginal] = useState(true);
  const [emitirBoletos, setEmitirBoletos] = useState(false);
  const [executando, setExecutando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoParcelamento | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const previa = useMemo(() => {
    try {
      return gerarParcelas({
        total: titulo.saldo,
        quantidade,
        primeiroVencimento,
        intervaloDias,
        acrescimoPercentual: Number(acrescimo.replace(",", ".")) || 0,
      });
    } catch {
      return [];
    }
  }, [titulo.saldo, quantidade, primeiroVencimento, intervaloDias, acrescimo]);

  async function parcelar() {
    setErro(null);
    setExecutando(true);
    try {
      const resposta = await postJson<ResultadoParcelamento>("/api/parcelamentos", {
        tituloId: titulo.id,
        clienteId: titulo.clienteId,
        saldo: titulo.saldo,
        documento: titulo.numeroDocumento,
        quantidade,
        primeiroVencimento,
        intervaloDias,
        acrescimoPercentual: Number(acrescimo.replace(",", ".")) || 0,
        contaCorrenteId: contaId ? Number(contaId) : null,
        excluirOriginal,
        emitirBoletos,
      });
      setResultado(resposta);
      onConcluido();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setExecutando(false);
    }
  }

  return (
    <Modal
      titulo="Parcelar título"
      descricao={`${titulo.clienteNome} · ${titulo.numeroDocumento} · saldo ${moeda(
        titulo.saldo,
      )}`}
      largura="max-w-3xl"
      onFechar={onFechar}
      rodape={
        resultado ? (
          <button className="btn-primario" onClick={onFechar}>
            Fechar
          </button>
        ) : (
          <>
            <span className="mr-auto text-sm text-suave">
              {previa.length} parcela(s) · total {moeda(somarParcelas(previa))}
            </span>
            <button className="btn" onClick={onFechar} disabled={executando}>
              Cancelar
            </button>
            <button
              className="btn-primario"
              onClick={parcelar}
              disabled={executando || previa.length === 0}
            >
              {executando ? "Criando parcelas…" : "Confirmar parcelamento"}
            </button>
          </>
        )
      }
    >
      {resultado ? (
        <div>
          <ul className="mb-4 space-y-2">
            {resultado.parcelas.map((parcela) => (
              <li
                key={parcela.numero}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  parcela.sucesso
                    ? "border-borda bg-cartao-alt"
                    : "border-negativo/40 bg-negativo-suave"
                }`}
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-medium">
                    Parcela {parcela.numero} · {moeda(parcela.valor)} · venc.{" "}
                    {dataBr(parcela.vencimento)}
                  </span>
                  <span className={parcela.sucesso ? "text-suave" : "text-negativo"}>
                    {parcela.mensagem}
                  </span>
                </div>
                {parcela.boleto?.link && (
                  <a
                    href={parcela.boleto.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-acento underline"
                  >
                    Abrir boleto
                  </a>
                )}
              </li>
            ))}
          </ul>

          {resultado.mensagemOriginal && (
            <p
              className={`rounded-lg px-3 py-2 text-sm ${
                resultado.originalExcluido
                  ? "bg-positivo-suave text-positivo"
                  : "bg-alerta-suave text-alerta"
              }`}
            >
              {resultado.mensagemOriginal}
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="mb-4 grid gap-3 md:grid-cols-4">
            <div>
              <label className="rotulo" htmlFor="qtd-parcelas">
                Parcelas
              </label>
              <select
                id="qtd-parcelas"
                className="campo"
                value={quantidade}
                onChange={(e) => setQuantidade(Number(e.target.value))}
              >
                {Array.from(
                  { length: MAX_PARCELAS - MIN_PARCELAS + 1 },
                  (_, i) => i + MIN_PARCELAS,
                ).map((n) => (
                  <option key={n} value={n}>
                    {n}x
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="rotulo" htmlFor="primeira-parcela">
                1ª parcela
              </label>
              <input
                id="primeira-parcela"
                type="date"
                className="campo"
                value={primeiroVencimento}
                onChange={(e) => setPrimeiroVencimento(e.target.value)}
              />
            </div>
            <div>
              <label className="rotulo" htmlFor="intervalo">
                Intervalo (dias)
              </label>
              <input
                id="intervalo"
                type="number"
                min={1}
                className="campo-num"
                value={intervaloDias}
                onChange={(e) => setIntervaloDias(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="rotulo" htmlFor="acrescimo">
                Acréscimo (%)
              </label>
              <input
                id="acrescimo"
                className="campo-num"
                inputMode="decimal"
                value={acrescimo}
                onChange={(e) => setAcrescimo(e.target.value)}
              />
            </div>
          </div>

          <div className="mb-4 grid gap-3 md:grid-cols-2">
            <div>
              <label className="rotulo" htmlFor="conta-parcelas">
                Conta corrente das parcelas
              </label>
              <select
                id="conta-parcelas"
                className="campo"
                value={contaId}
                onChange={(e) => setContaId(e.target.value)}
              >
                <option value="">Manter a conta do título original</option>
                {contas.map((conta) => (
                  <option key={conta.id} value={conta.id}>
                    {conta.descricao}
                    {conta.banco ? ` — ${conta.banco}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col justify-end gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={excluirOriginal}
                  onChange={(e) => setExcluirOriginal(e.target.checked)}
                />
                Excluir o título original depois de criar as parcelas
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={emitirBoletos}
                  onChange={(e) => setEmitirBoletos(e.target.checked)}
                />
                Emitir boleto de cada parcela
              </label>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Parcela</th>
                  <th>Vencimento</th>
                  <th className="num">Valor</th>
                </tr>
              </thead>
              <tbody>
                {previa.map((parcela) => (
                  <tr key={parcela.numero}>
                    <td>
                      {String(parcela.numero).padStart(3, "0")}/
                      {String(quantidade).padStart(3, "0")}
                    </td>
                    <td>{dataBr(parcela.vencimento)}</td>
                    <td className="num">{moeda(parcela.valor)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-medium">
                  <td colSpan={2}>Total</td>
                  <td className="num">{moeda(somarParcelas(previa))}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="mt-3 text-xs text-suave">
            A diferença de arredondamento fica na primeira parcela, então a soma das
            parcelas é sempre igual ao total.
          </p>

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
