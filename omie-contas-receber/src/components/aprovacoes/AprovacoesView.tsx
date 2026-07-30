"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/Toasts";
import { dataHoraBr, moeda, percentual } from "@/lib/format";
import { postJson } from "@/lib/lote";
import type { Aprovacao, Perfil } from "@/lib/types";

export function AprovacoesView({
  aprovacoes,
  perfil,
}: {
  aprovacoes: Aprovacao[];
  perfil: Perfil;
}) {
  const router = useRouter();
  const toast = useToast();
  const [, iniciarTransicao] = useTransition();
  const [emAndamento, setEmAndamento] = useState<string | null>(null);

  const pendentes = aprovacoes.filter((a) => a.status === "pendente");
  const decididas = aprovacoes.filter((a) => a.status !== "pendente");
  const gestor = perfil === "gestor";

  async function decidir(aprovacao: Aprovacao, acao: "aprovar" | "rejeitar") {
    if (acao === "rejeitar" && !confirm(`Rejeitar o desconto de ${aprovacao.clienteNome}?`)) {
      return;
    }
    setEmAndamento(aprovacao.id);
    try {
      const resposta = await postJson<{
        resultado: { sucesso: boolean; mensagem: string };
      }>("/api/aprovacoes", { id: aprovacao.id, acao });
      toast(resposta.resultado.mensagem, resposta.resultado.sucesso ? "ok" : "erro");
      iniciarTransicao(() => router.refresh());
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "erro");
    } finally {
      setEmAndamento(null);
    }
  }

  return (
    <>
      {!gestor && (
        <p className="aviso aviso-alerta">
          Somente gestores decidem estas solicitações. Você vê aqui o andamento dos descontos
          manuais que enviou.
        </p>
      )}

      {pendentes.length === 0 ? (
        <div className="max-w-[940px] rounded-lg border border-dashed border-borda px-6 py-10 text-center">
          <p className="text-[13.5px] font-semibold">Nenhuma aprovação pendente</p>
          <p className="mt-1 text-[12.5px] text-fraco">
            Descontos dentro do percentual de contrato são aplicados sem aprovação.
          </p>
        </div>
      ) : (
        <div className="flex max-w-[940px] flex-col gap-2.5">
          {pendentes.map((aprovacao) => (
            <article
              key={aprovacao.id}
              className="cartao grid gap-3 p-3.5 md:grid-cols-[1fr_200px]"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13.5px] font-semibold">{aprovacao.clienteNome}</span>
                  <span className="mono text-[11px] text-fraco">{aprovacao.documento}</span>
                  <span className="selo bg-alerta-suave text-alerta">
                    −{percentual(aprovacao.percentual)} manual
                  </span>
                </div>

                <p className="mono mt-1.5 text-[12px] text-suave">
                  saldo {moeda(aprovacao.saldo)} · desconto{" "}
                  <span className="text-negativo">−{moeda(aprovacao.valorDesconto)}</span> ·
                  restará <span className="font-semibold">{moeda(aprovacao.saldoFinal)}</span>
                </p>

                <p className="mt-2 text-[12.5px]">{aprovacao.justificativa}</p>
                <p className="mt-1 text-[11px] text-fraco">
                  solicitado por {aprovacao.solicitante} · {dataHoraBr(aprovacao.criadoEm)}
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <button
                  className="btn-primario"
                  disabled={!gestor || emAndamento === aprovacao.id}
                  onClick={() => decidir(aprovacao, "aprovar")}
                >
                  {emAndamento === aprovacao.id ? "Gravando…" : "Aprovar e gravar no Omie"}
                </button>
                <button
                  className="btn"
                  disabled={!gestor || emAndamento === aprovacao.id}
                  onClick={() => decidir(aprovacao, "rejeitar")}
                >
                  Rejeitar
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {decididas.length > 0 && (
        <section className="cartao max-w-[940px] overflow-hidden">
          <p className="eyebrow px-3.5 pt-3.5 pb-2">Histórico de decisões</p>
          <table className="tabela">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Documento</th>
                <th className="text-right">Desconto</th>
                <th>Solicitante</th>
                <th>Decisão</th>
                <th>Quando</th>
              </tr>
            </thead>
            <tbody>
              {decididas.map((aprovacao) => (
                <tr key={aprovacao.id}>
                  <td className="font-medium">{aprovacao.clienteNome}</td>
                  <td className="mono text-[12px]">{aprovacao.documento}</td>
                  <td className="num text-negativo">−{moeda(aprovacao.valorDesconto)}</td>
                  <td>{aprovacao.solicitante}</td>
                  <td>
                    <span
                      className={`selo ${
                        aprovacao.status === "aprovado"
                          ? "bg-positivo-suave text-positivo"
                          : "bg-cartao-3 text-fraco"
                      }`}
                    >
                      {aprovacao.status}
                    </span>
                    {aprovacao.decisor && (
                      <span className="ml-1.5 text-[11px] text-fraco">
                        por {aprovacao.decisor}
                      </span>
                    )}
                  </td>
                  <td className="mono text-[11.5px] text-suave">
                    {dataHoraBr(aprovacao.decididoEm)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
