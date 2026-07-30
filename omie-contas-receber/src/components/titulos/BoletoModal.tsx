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
  onConcluido: (mensagem?: string) => void;
}) {
  const [progresso, setProgresso] = useState<ProgressoLote | null>(null);
  const [resultados, setResultados] = useState<ResultadoItem[]>([]);

  const executando = progresso !== null && progresso.atual < progresso.total;
  const concluido = resultados.length > 0 && !executando;
  const jaEmitidos = titulos.filter((t) => t.boletoEmitido);

  async function emitir(lista: Titulo[]) {
    setProgresso({ atual: 0, total: lista.length });

    const finais = await enviarSequencial(
      lista,
      (titulo) => titulo.id,
      async (titulo) => {
        setProgresso((atual) => ({
          atual: atual?.atual ?? 0,
          total: lista.length,
          descricao: `Emitindo boleto — ${titulo.clienteNome}`,
          rota: "financas/contareceberboleto · EmitirBoleto",
        }));
        const resposta = await postJson<{ resultados: ResultadoItem[] }>("/api/boletos", {
          tituloIds: [titulo.id],
        });
        return resposta.resultados;
      },
      (concluidos) =>
        setProgresso((atual) => ({ ...atual!, atual: concluidos, total: lista.length })),
    );

    setResultados((anteriores) => {
      const ids = finais.map((f) => f.tituloId);
      return [...anteriores.filter((a) => !ids.includes(a.tituloId)), ...finais];
    });

    const ok = finais.filter((r) => r.sucesso).length;
    onConcluido(`${ok} boleto(s) emitido(s) pelo Omie.`);
  }

  const links = resultados
    .map((r) => (r.detalhe as { link?: string | null } | undefined)?.link)
    .filter((l): l is string => Boolean(l));

  return (
    <Modal
      titulo="Emitir boleto"
      descricao="Boletos gerados pela API do Omie — o sistema apenas exibe o PDF/link retornado."
      largura="max-w-[760px]"
      onFechar={onFechar}
      rodape={
        concluido ? (
          <>
            <span className="mr-auto text-[12px] text-suave">
              {resultados.filter((r) => r.sucesso).length} boleto(s) emitido(s) ·{" "}
              {resultados.filter((r) => !r.sucesso).length} falha(s)
            </span>
            {links.length > 1 && (
              <button
                className="btn btn-modal"
                onClick={() => links.forEach((link) => window.open(link, "_blank"))}
              >
                Baixar todos os PDFs ({links.length})
              </button>
            )}
            <button className="btn-primario btn-modal" onClick={onFechar}>
              Fechar
            </button>
          </>
        ) : (
          <>
            <span className="mr-auto text-[12px] text-suave">
              {titulos.length} título(s) selecionado(s)
            </span>
            <button className="btn btn-modal" onClick={onFechar} disabled={executando}>
              Cancelar
            </button>
            <button
              className="btn-primario btn-modal"
              onClick={() => emitir(titulos)}
              disabled={executando}
            >
              {executando ? "Emitindo…" : "Emitir boletos"}
            </button>
          </>
        )
      }
    >
      {executando && progresso && <BarraProgresso progresso={progresso} />}

      {concluido ? (
        <ResultadoLote
          resultados={resultados}
          onTentarNovamente={(tituloId) => {
            const titulo = titulos.find((t) => t.id === tituloId);
            if (titulo) void emitir([titulo]);
          }}
        />
      ) : (
        !executando && (
          <>
            {jaEmitidos.length > 0 && (
              <p className="aviso aviso-alerta mb-3.5">
                {jaEmitidos.length} título(s) já possuem boleto emitido. Emitir novamente gera
                uma nova via no Omie.
              </p>
            )}

            <div className="cartao overflow-hidden">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Documento</th>
                    <th className="text-right">Vencimento</th>
                    <th className="text-right">Saldo</th>
                    <th>Conta corrente</th>
                    <th>Boleto</th>
                  </tr>
                </thead>
                <tbody>
                  {titulos.map((titulo) => (
                    <tr key={titulo.id}>
                      <td className="font-medium">{titulo.clienteNome}</td>
                      <td className="mono text-[12px]">{titulo.numeroDocumento}</td>
                      <td className="num">{dataBr(titulo.vencimento)}</td>
                      <td className="num">{moeda(titulo.saldo)}</td>
                      <td className="text-[12px]">{titulo.contaCorrenteNome ?? "—"}</td>
                      <td className="mono text-[11px] text-fraco">
                        {titulo.boletoEmitido ? "emitido" : "não emitido"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )
      )}
    </Modal>
  );
}
