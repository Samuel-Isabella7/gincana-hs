"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import {
  BarraProgresso,
  ResultadoLote,
  type ProgressoLote,
} from "@/components/ui/ResultadoLote";
import { contratoVigente } from "@/lib/desconto";
import { moeda } from "@/lib/format";
import { enviarSequencial, postJson } from "@/lib/lote";
import type { ContaCorrente, Contrato, ResultadoItem, Titulo } from "@/lib/types";

/**
 * Aplica a conta corrente definida no contrato de cada cliente. Serve para
 * quem não tem desconto, mas precisa ser cobrado sempre no mesmo banco.
 */
export function BancoContratoModal({
  titulos,
  contratos,
  contas,
  onFechar,
  onConcluido,
}: {
  titulos: Titulo[];
  contratos: Contrato[];
  contas: ContaCorrente[];
  onFechar: () => void;
  onConcluido: (mensagem?: string) => void;
}) {
  const [progresso, setProgresso] = useState<ProgressoLote | null>(null);
  const [resultados, setResultados] = useState<ResultadoItem[]>([]);

  const executando = progresso !== null && progresso.atual < progresso.total;
  const concluido = resultados.length > 0 && !executando;

  const linhas = titulos.map((titulo) => {
    const contrato = contratoVigente(contratos, titulo.clienteId);
    const destinoId = contrato?.contaCorrentePreferencial ?? null;
    return {
      titulo,
      contrato,
      destino: contas.find((c) => c.id === destinoId) ?? null,
      semContrato: !contrato,
      semConta: Boolean(contrato) && !destinoId,
      jaCerto: destinoId != null && destinoId === titulo.contaCorrenteId,
    };
  });

  const aplicaveis = linhas.filter((l) => l.destino && !l.jaCerto);

  async function aplicar() {
    setProgresso({ atual: 0, total: titulos.length });

    const finais = await enviarSequencial(
      titulos,
      (titulo) => titulo.id,
      async (titulo) => {
        setProgresso((atual) => ({
          atual: atual?.atual ?? 0,
          total: titulos.length,
          descricao: `Ajustando conta — ${titulo.clienteNome}`,
          rota: "financas/contareceber · AlterarContaReceber",
        }));
        const resposta = await postJson<{ resultados: ResultadoItem[] }>(
          "/api/conta-corrente/contrato",
          {
            itens: [
              {
                tituloId: titulo.id,
                clienteId: titulo.clienteId,
                clienteNome: titulo.clienteNome,
                contaCorrenteTituloId: titulo.contaCorrenteId,
              },
            ],
          },
        );
        return resposta.resultados;
      },
      (concluidos) =>
        setProgresso((atual) => ({ ...atual!, atual: concluidos, total: titulos.length })),
    );

    setResultados(finais);
    onConcluido(
      `Conta do contrato aplicada em ${finais.filter((r) => r.sucesso).length} título(s).`,
    );
  }

  return (
    <Modal
      titulo="Aplicar banco do contrato"
      descricao="Move cada título para a conta corrente cadastrada no contrato do cliente."
      largura="max-w-[720px]"
      onFechar={onFechar}
      rodape={
        concluido ? (
          <button className="btn-primario btn-modal ml-auto" onClick={onFechar}>
            Fechar
          </button>
        ) : (
          <>
            <span className="mr-auto text-[12px] text-suave">
              {aplicaveis.length} de {titulos.length} título(s) serão alterados
            </span>
            <button className="btn btn-modal" onClick={onFechar} disabled={executando}>
              Cancelar
            </button>
            <button
              className="btn-primario btn-modal"
              onClick={aplicar}
              disabled={executando || aplicaveis.length === 0}
            >
              {executando ? "Aplicando…" : "Aplicar contas do contrato"}
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
          <div className="cartao overflow-hidden">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Documento</th>
                  <th className="text-right">Saldo</th>
                  <th>Conta atual</th>
                  <th>Conta do contrato</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((linha) => (
                  <tr key={linha.titulo.id}>
                    <td className="font-medium">{linha.titulo.clienteNome}</td>
                    <td className="mono text-[12px]">{linha.titulo.numeroDocumento}</td>
                    <td className="num">{moeda(linha.titulo.saldo)}</td>
                    <td className="text-[12px]">{linha.titulo.contaCorrenteNome ?? "—"}</td>
                    <td className="text-[12px]">
                      {linha.destino ? (
                        linha.jaCerto ? (
                          <span className="text-suave">já correta</span>
                        ) : (
                          <span className="font-medium text-acento">
                            {linha.destino.descricao}
                          </span>
                        )
                      ) : (
                        <span className="text-alerta">
                          {linha.semContrato
                            ? "cliente sem contrato"
                            : "contrato sem conta definida"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </Modal>
  );
}
