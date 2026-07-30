"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import {
  BarraProgresso,
  ResultadoLote,
  type ProgressoLote,
} from "@/components/ui/ResultadoLote";
import { dataBr, moeda } from "@/lib/format";
import { enviarSequencial, postJson } from "@/lib/lote";
import type { ContaCorrente, ResultadoItem, Titulo } from "@/lib/types";

export function ContaCorrenteModal({
  titulos,
  contas,
  onFechar,
  onConcluido,
}: {
  titulos: Titulo[];
  contas: ContaCorrente[];
  onFechar: () => void;
  onConcluido: () => void;
}) {
  const [contaId, setContaId] = useState("");
  const [progresso, setProgresso] = useState<ProgressoLote | null>(null);
  const [resultados, setResultados] = useState<ResultadoItem[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const executando = progresso !== null && progresso.atual < progresso.total;
  const concluido = resultados.length > 0 && !executando;
  const comBoleto = titulos.filter((t) => t.boletoEmitido);
  const destino = contas.find((c) => String(c.id) === contaId);

  async function trocar() {
    if (!contaId) {
      setErro("Selecione a conta corrente de destino.");
      return;
    }
    setErro(null);
    setResultados([]);
    setProgresso({ atual: 0, total: titulos.length });

    const finais = await enviarSequencial(
      titulos,
      (titulo) => titulo.id,
      async (titulo) => {
        const resposta = await postJson<{ resultados: ResultadoItem[] }>(
          "/api/conta-corrente",
          { tituloIds: [titulo.id], contaCorrenteId: Number(contaId) },
        );
        return resposta.resultados;
      },
      (concluidos) => setProgresso({ atual: concluidos, total: titulos.length }),
    );

    setResultados(finais);
    onConcluido();
  }

  return (
    <Modal
      titulo="Trocar conta corrente do título"
      descricao="Altera apenas a conta corrente (banco) do título no Omie. Boletos já emitidos continuam válidos no banco de origem."
      onFechar={onFechar}
      rodape={
        concluido ? (
          <button className="btn-primario" onClick={onFechar}>
            Fechar
          </button>
        ) : (
          <>
            <span className="mr-auto text-sm text-suave">
              {titulos.length} título(s)
              {destino ? ` → ${destino.descricao}` : ""}
            </span>
            <button className="btn" onClick={onFechar} disabled={executando}>
              Cancelar
            </button>
            <button className="btn-primario" onClick={trocar} disabled={executando}>
              {executando ? "Alterando…" : "Alterar conta corrente"}
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
          <div className="mb-4 max-w-sm">
            <label className="rotulo" htmlFor="conta-destino">
              Conta corrente de destino
            </label>
            <select
              id="conta-destino"
              className="campo"
              value={contaId}
              onChange={(e) => setContaId(e.target.value)}
            >
              <option value="">Selecione…</option>
              {contas.map((conta) => (
                <option key={conta.id} value={conta.id}>
                  {conta.descricao}
                  {conta.banco ? ` — ${conta.banco}` : ""}
                </option>
              ))}
            </select>
          </div>

          {comBoleto.length > 0 && (
            <p className="mb-4 rounded-lg bg-alerta-suave px-3 py-2 text-sm text-alerta">
              {comBoleto.length} título(s) já possuem boleto emitido. Trocar a conta não
              invalida o boleto existente — se o cliente precisa pagar no novo banco, emita
              um novo boleto depois da troca.
            </p>
          )}

          <div className="overflow-x-auto">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Documento</th>
                  <th>Vencimento</th>
                  <th className="num">Saldo</th>
                  <th>Conta atual</th>
                </tr>
              </thead>
              <tbody>
                {titulos.map((titulo) => (
                  <tr key={titulo.id}>
                    <td className="font-medium">{titulo.clienteNome}</td>
                    <td>{titulo.numeroDocumento}</td>
                    <td>{dataBr(titulo.vencimento)}</td>
                    <td className="num">{moeda(titulo.saldo)}</td>
                    <td>{titulo.contaCorrenteNome ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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
