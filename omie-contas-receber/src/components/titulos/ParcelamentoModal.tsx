"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { dataBr, hoje, moeda, somarDias } from "@/lib/format";
import { postJson } from "@/lib/lote";
import type { ResultadoParcelamento } from "@/lib/operacoes-tipos";
import {
  gerarParcelas,
  MAX_PARCELAS,
  MIN_PARCELAS,
  somarParcelas,
} from "@/lib/parcelamento";
import type { ContaCorrente, PoliticaOriginal, Titulo } from "@/lib/types";

export function ParcelamentoModal({
  titulo,
  contas,
  onFechar,
  onConcluido,
}: {
  titulo: Titulo;
  contas: ContaCorrente[];
  onFechar: () => void;
  onConcluido: (mensagem?: string) => void;
}) {
  const [quantidade, setQuantidade] = useState(2);
  const [primeiroVencimento, setPrimeiroVencimento] = useState(
    somarDias(titulo.vencimento || hoje(), 30),
  );
  const [intervaloDias, setIntervaloDias] = useState(30);
  const [acrescimo, setAcrescimo] = useState("0");
  const [contaId, setContaId] = useState(
    titulo.contaCorrenteId ? String(titulo.contaCorrenteId) : "",
  );
  const [politica, setPolitica] = useState<PoliticaOriginal>("baixado");
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

  const total = somarParcelas(previa);

  async function parcelar() {
    setErro(null);
    setExecutando(true);
    try {
      const resposta = await postJson<ResultadoParcelamento>("/api/parcelamentos", {
        tituloId: titulo.id,
        clienteId: titulo.clienteId,
        clienteNome: titulo.clienteNome,
        saldo: titulo.saldo,
        documento: titulo.numeroDocumento,
        quantidade,
        primeiroVencimento,
        intervaloDias,
        acrescimoPercentual: Number(acrescimo.replace(",", ".")) || 0,
        contaCorrenteId: contaId ? Number(contaId) : null,
        politicaOriginal: politica,
        emitirBoletos,
      });
      setResultado(resposta);
      onConcluido(`Título parcelado em ${quantidade}x.`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setExecutando(false);
    }
  }

  return (
    <Modal
      titulo="Parcelar título"
      descricao={`${titulo.clienteNome} · ${titulo.numeroDocumento} · saldo ${moeda(titulo.saldo)}`}
      largura="max-w-[880px]"
      onFechar={onFechar}
      rodape={
        resultado ? (
          <button className="btn-primario btn-modal ml-auto" onClick={onFechar}>
            Fechar
          </button>
        ) : (
          <>
            <span className="mono mr-auto text-[12px] text-suave">
              {previa.length} parcela(s) · total {moeda(total)}
            </span>
            <button className="btn btn-modal" onClick={onFechar} disabled={executando}>
              Cancelar
            </button>
            <button
              className="btn-primario btn-modal"
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
          <ul className="mb-3.5 flex flex-col gap-1.5">
            {resultado.parcelas.map((parcela) => (
              <li
                key={parcela.numero}
                className={`rounded-md border px-2.5 py-2 text-[12.5px] ${
                  parcela.sucesso
                    ? "border-borda bg-cartao-alt"
                    : "border-negativo/40 bg-negativo-suave"
                }`}
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="mono font-medium">
                    {String(parcela.numero).padStart(3, "0")}/
                    {String(resultado.parcelas.length).padStart(3, "0")} ·{" "}
                    {moeda(parcela.valor)} · venc. {dataBr(parcela.vencimento)}
                  </span>
                  <span className={parcela.sucesso ? "text-suave" : "text-negativo"}>
                    {parcela.mensagem}
                  </span>
                  {parcela.boleto?.link && (
                    <a
                      href={parcela.boleto.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto text-[11.5px]"
                    >
                      PDF ↓
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {resultado.mensagemOriginal && (
            <p
              className={`aviso ${
                resultado.originalExcluido || resultado.originalBaixado
                  ? "aviso-ok"
                  : "aviso-alerta"
              }`}
            >
              {resultado.mensagemOriginal}
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-[300px_1fr]">
          <div className="flex flex-col gap-3.5">
            <div>
              <label className="rotulo">Parcelas</label>
              <div className="flex flex-wrap gap-1">
                {Array.from(
                  { length: MAX_PARCELAS - MIN_PARCELAS + 1 },
                  (_, i) => i + MIN_PARCELAS,
                ).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setQuantidade(n)}
                    className={`h-[30px] w-8 cursor-pointer rounded-md border text-[12px] transition ${
                      quantidade === n
                        ? "border-acento bg-acento-suave font-semibold text-acento"
                        : "border-borda bg-cartao text-suave hover:border-acento-linha"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
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
            </div>

            <div className="grid grid-cols-2 gap-2">
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
              <div>
                <label className="rotulo" htmlFor="conta-parcelas">
                  Conta corrente
                </label>
                <select
                  id="conta-parcelas"
                  className="campo"
                  value={contaId}
                  onChange={(e) => setContaId(e.target.value)}
                >
                  <option value="">Manter a do título</option>
                  {contas.map((conta) => (
                    <option key={conta.id} value={conta.id}>
                      {conta.descricao}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="rotulo">Título original</label>
              <div className="flex flex-col gap-1.5">
                <label
                  className={`flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-2 text-[12.5px] ${
                    politica === "baixado"
                      ? "border-acento-linha bg-acento-suave"
                      : "border-borda"
                  }`}
                >
                  <input
                    type="radio"
                    name="politica"
                    className="mt-0.5"
                    checked={politica === "baixado"}
                    onChange={() => setPolitica("baixado")}
                  />
                  <span>
                    Baixar como parcelado
                    <span className="mono block text-[10.5px] text-fraco">
                      recebimento de valor zero com desconto = saldo, sem entrada de dinheiro
                    </span>
                  </span>
                </label>
                <label
                  className={`flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-2 text-[12.5px] ${
                    politica === "excluido"
                      ? "border-acento-linha bg-acento-suave"
                      : "border-borda"
                  }`}
                >
                  <input
                    type="radio"
                    name="politica"
                    className="mt-0.5"
                    checked={politica === "excluido"}
                    onChange={() => setPolitica("excluido")}
                  />
                  <span>
                    Excluir do Omie
                    <span className="mono block text-[10.5px] text-fraco">
                      ExcluirContaReceber — só funciona sem baixas nem boleto
                    </span>
                  </span>
                </label>
              </div>
            </div>

            <label className="flex items-center gap-2 text-[12.5px]">
              <input
                type="checkbox"
                checked={emitirBoletos}
                onChange={(e) => setEmitirBoletos(e.target.checked)}
              />
              Emitir boleto de todas as parcelas
            </label>
          </div>

          <div>
            <p className="eyebrow mb-1.5">Prévia das parcelas</p>
            <div className="cartao overflow-hidden">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Parcela</th>
                    <th className="text-right">Vencimento</th>
                    <th className="text-right">Valor</th>
                    <th>Obs.</th>
                  </tr>
                </thead>
                <tbody>
                  {previa.map((parcela) => (
                    <tr key={parcela.numero}>
                      <td className="mono">
                        {parcela.numero}/{quantidade}
                      </td>
                      <td className="num">{dataBr(parcela.vencimento)}</td>
                      <td className="num font-semibold">{moeda(parcela.valor)}</td>
                      <td className="text-[11px] text-fraco">
                        {parcela.numero === 1 ? "ajuste de arredondamento" : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}>Soma das parcelas</td>
                    <td className="num">{moeda(total)}</td>
                    <td />
                  </tr>
                  <tr>
                    <td colSpan={2} className="text-suave">
                      Saldo do título original
                    </td>
                    <td className="num text-suave">{moeda(titulo.saldo)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="mono mt-2 text-[10.5px] text-fraco">
              cada parcela entra como um novo título (IncluirContaReceber) e o original segue a
              política escolhida
            </p>

            {erro && <p className="aviso aviso-erro mt-3">{erro}</p>}
          </div>
        </div>
      )}
    </Modal>
  );
}
