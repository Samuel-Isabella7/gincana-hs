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
import type { ResultadoItem, Titulo } from "@/lib/types";

export function BoletoModal({
  titulos,
  onFechar,
  onConcluido,
}: {
  titulos: Titulo[];
  onFechar: () => void;
  onConcluido: () => void;
}) {
  const [progresso, setProgresso] = useState<ProgressoLote | null>(null);
  const [resultados, setResultados] = useState<ResultadoItem[]>([]);

  const executando = progresso !== null && progresso.atual < progresso.total;
  const concluido = resultados.length > 0 && !executando;
  const jaEmitidos = titulos.filter((t) => t.boletoEmitido);

  async function emitir() {
    setResultados([]);
    setProgresso({ atual: 0, total: titulos.length });

    const finais = await enviarSequencial(
      titulos,
      (titulo) => titulo.id,
      async (titulo) => {
        const resposta = await postJson<{ resultados: ResultadoItem[] }>("/api/boletos", {
          tituloIds: [titulo.id],
        });
        return resposta.resultados;
      },
      (concluidos) => setProgresso({ atual: concluidos, total: titulos.length }),
    );

    setResultados(finais);
    onConcluido();
  }

  const links = resultados
    .map((r) => (r.detalhe as { link?: string | null } | undefined)?.link)
    .filter((l): l is string => Boolean(l));

  return (
    <Modal
      titulo="Emitir boleto"
      descricao="Os boletos são gerados pelo Omie. O sistema apenas dispara a emissão e guarda o link retornado."
      onFechar={onFechar}
      rodape={
        concluido ? (
          <>
            {links.length > 1 && (
              <button
                className="btn mr-auto"
                onClick={() => links.forEach((link) => window.open(link, "_blank"))}
              >
                Abrir todos ({links.length})
              </button>
            )}
            <button className="btn-primario" onClick={onFechar}>
              Fechar
            </button>
          </>
        ) : (
          <>
            <span className="mr-auto text-sm text-suave">
              {titulos.length} título(s) selecionado(s)
            </span>
            <button className="btn" onClick={onFechar} disabled={executando}>
              Cancelar
            </button>
            <button className="btn-primario" onClick={emitir} disabled={executando}>
              {executando ? "Emitindo…" : "Emitir boletos"}
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
          {jaEmitidos.length > 0 && (
            <p className="mb-4 rounded-lg bg-alerta-suave px-3 py-2 text-sm text-alerta">
              {jaEmitidos.length} título(s) já possuem boleto emitido. Emitir novamente
              gera uma nova via no Omie.
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
                  <th>Conta corrente</th>
                  <th>Boleto</th>
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
                    <td className="text-xs text-suave">
                      {titulo.boletoEmitido ? "já emitido" : "não emitido"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}
