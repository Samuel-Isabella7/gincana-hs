"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import {
  BarraProgresso,
  ResultadoLote,
  type ProgressoLote,
} from "@/components/ui/ResultadoLote";
import { moeda } from "@/lib/format";
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
  onConcluido: (mensagem?: string) => void;
}) {
  const [contaId, setContaId] = useState("");
  const [progresso, setProgresso] = useState<ProgressoLote | null>(null);
  const [resultados, setResultados] = useState<ResultadoItem[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const executando = progresso !== null && progresso.atual < progresso.total;
  const concluido = resultados.length > 0 && !executando;
  const comBoleto = titulos.filter((t) => t.boletoEmitido);
  const bancosOrigem = [
    ...new Set(comBoleto.map((t) => t.contaCorrenteNome).filter(Boolean)),
  ].join(", ");

  async function trocar() {
    if (!contaId) {
      setErro("Selecione a conta corrente de destino.");
      return;
    }
    setErro(null);
    setProgresso({ atual: 0, total: titulos.length });

    const finais = await enviarSequencial(
      titulos,
      (titulo) => titulo.id,
      async (titulo) => {
        setProgresso((atual) => ({
          atual: atual?.atual ?? 0,
          total: titulos.length,
          descricao: `Alterando conta — ${titulo.clienteNome}`,
          rota: "financas/contareceber · AlterarContaReceber",
        }));
        const resposta = await postJson<{ resultados: ResultadoItem[] }>(
          "/api/conta-corrente",
          { tituloIds: [titulo.id], contaCorrenteId: Number(contaId) },
        );
        return resposta.resultados;
      },
      (concluidos) =>
        setProgresso((atual) => ({ ...atual!, atual: concluidos, total: titulos.length })),
    );

    setResultados(finais);
    onConcluido(`Conta corrente alterada em ${finais.filter((r) => r.sucesso).length} título(s).`);
  }

  return (
    <Modal
      titulo={`Trocar conta bancária de ${titulos.length} título(s)`}
      descricao="Altera apenas a conta corrente do título no Omie."
      largura="max-w-[560px]"
      onFechar={onFechar}
      rodape={
        concluido ? (
          <button className="btn-primario btn-modal ml-auto" onClick={onFechar}>
            Fechar
          </button>
        ) : (
          <>
            <span className="mono mr-auto text-[11px] text-fraco">
              altera id_conta_corrente via AlterarContaReceber
            </span>
            <button className="btn btn-modal" onClick={onFechar} disabled={executando}>
              Cancelar
            </button>
            <button className="btn-primario btn-modal" onClick={trocar} disabled={executando}>
              {executando ? "Alterando…" : "Confirmar troca"}
            </button>
          </>
        )
      }
    >
      {executando && progresso && <BarraProgresso progresso={progresso} />}

      {concluido ? (
        <ResultadoLote resultados={resultados} />
      ) : (
        !executando && (
          <>
            <div className="mb-3.5">
              <label className="rotulo" htmlFor="conta-destino">
                Nova conta corrente
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
              <p className="aviso aviso-alerta mb-3.5">
                <strong>
                  {comBoleto.length} título(s) selecionado(s) já possuem boleto emitido
                  {bancosOrigem ? ` (${bancosOrigem})` : ""}
                </strong>{" "}
                — trocar a conta não invalida o boleto existente. Nenhum boleto será cancelado
                ou reemitido.
              </p>
            )}

            <ul className="flex flex-col gap-1">
              {titulos.map((titulo) => (
                <li
                  key={titulo.id}
                  className="flex flex-wrap items-baseline gap-2 rounded-md bg-cartao-alt px-2.5 py-1.5 text-[12.5px]"
                >
                  <span className="font-medium">{titulo.clienteNome}</span>
                  <span className="mono text-[11px] text-fraco">
                    {titulo.numeroDocumento} · {moeda(titulo.saldo)}
                  </span>
                  <span className="ml-auto text-[11.5px] text-suave">
                    {titulo.contaCorrenteNome ?? "sem conta"} →{" "}
                    {contas.find((c) => String(c.id) === contaId)?.descricao ?? "…"}
                  </span>
                </li>
              ))}
            </ul>

            {erro && <p className="aviso aviso-erro mt-3">{erro}</p>}
          </>
        )
      )}
    </Modal>
  );
}
