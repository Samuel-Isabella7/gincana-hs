"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { dataHoraBr } from "@/lib/format";
import type { EventoAuditoria } from "@/lib/types";

const ACOES = [
  { valor: "", rotulo: "Todas as ações" },
  { valor: "desconto", rotulo: "Desconto" },
  { valor: "boleto", rotulo: "Boleto" },
  { valor: "parcelamento", rotulo: "Parcelamento" },
  { valor: "conta_corrente", rotulo: "Conta corrente" },
  { valor: "contrato", rotulo: "Contrato" },
  { valor: "login", rotulo: "Login" },
];

export function EventosView({
  eventos,
  filtros,
}: {
  eventos: EventoAuditoria[];
  filtros: { acao: string; usuario: string; de: string; ate: string };
}) {
  const router = useRouter();
  const [, iniciarTransicao] = useTransition();
  const [expandido, setExpandido] = useState<string | null>(null);

  function aplicar(campo: keyof typeof filtros, valor: string) {
    const parametros = new URLSearchParams(filtros as Record<string, string>);
    if (valor) parametros.set(campo, valor);
    else parametros.delete(campo);
    iniciarTransicao(() => router.push(`/auditoria?${parametros.toString()}`));
  }

  function exportarCsv() {
    const cabecalho = ["data", "usuario", "acao", "entidade", "descricao", "sucesso", "erro"];
    const linhas = eventos.map((e) =>
      [
        e.criadoEm,
        e.usuario,
        e.acao,
        e.entidade,
        e.descricao.replace(/"/g, "'"),
        e.sucesso ? "sim" : "não",
        (e.erro ?? "").replace(/"/g, "'"),
      ]
        .map((campo) => `"${campo}"`)
        .join(";"),
    );

    const blob = new Blob([[cabecalho.join(";"), ...linhas].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "auditoria.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <section className="cartao flex flex-wrap items-end gap-2 bg-cartao-alt p-2.5">
        <div className="w-[160px]">
          <label className="rotulo" htmlFor="f-acao">
            Ação
          </label>
          <select
            id="f-acao"
            className="campo"
            value={filtros.acao}
            onChange={(e) => aplicar("acao", e.target.value)}
          >
            {ACOES.map((a) => (
              <option key={a.valor} value={a.valor}>
                {a.rotulo}
              </option>
            ))}
          </select>
        </div>
        <div className="w-[170px]">
          <label className="rotulo" htmlFor="f-usuario">
            Usuário
          </label>
          <input
            id="f-usuario"
            className="campo"
            defaultValue={filtros.usuario}
            onBlur={(e) => aplicar("usuario", e.target.value)}
            placeholder="login do operador"
          />
        </div>
        <div className="w-[140px]">
          <label className="rotulo" htmlFor="f-de">
            De
          </label>
          <input
            id="f-de"
            type="date"
            className="campo"
            value={filtros.de}
            onChange={(e) => aplicar("de", e.target.value)}
          />
        </div>
        <div className="w-[140px]">
          <label className="rotulo" htmlFor="f-ate">
            Até
          </label>
          <input
            id="f-ate"
            type="date"
            className="campo"
            value={filtros.ate}
            onChange={(e) => aplicar("ate", e.target.value)}
          />
        </div>
        <span className="mono ml-auto text-[11px] text-fraco">somente leitura</span>
        <button className="btn" onClick={exportarCsv}>
          Exportar CSV
        </button>
      </section>

      <section className="cartao cartao-sombra overflow-hidden">
        <div className="overflow-x-auto">
          <table className="tabela">
            <thead>
              <tr>
                <th className="w-8" />
                <th>Data/hora</th>
                <th>Usuário</th>
                <th>Ação</th>
                <th>Entidade</th>
                <th>Descrição</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {eventos.map((evento) => {
                const aberto = expandido === evento.id;
                return (
                  <>
                    <tr
                      key={evento.id}
                      className="cursor-pointer"
                      onClick={() => setExpandido(aberto ? null : evento.id)}
                    >
                      <td className="text-center text-fraco">{aberto ? "▾" : "▸"}</td>
                      <td className="mono text-[11.5px]">{dataHoraBr(evento.criadoEm)}</td>
                      <td className="text-[12px]">{evento.usuario}</td>
                      <td>
                        <span className="selo bg-cartao-3 text-suave">
                          {evento.acao.replace("_", " ")}
                        </span>
                      </td>
                      <td className="mono text-[11.5px]">{evento.entidade}</td>
                      <td className="max-w-[420px]">
                        <span className="block truncate">{evento.descricao}</span>
                        {evento.erro && (
                          <span className="block truncate text-[11px] text-negativo">
                            {evento.erro}
                          </span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`selo ${
                            evento.sucesso
                              ? "bg-positivo-suave text-positivo"
                              : "bg-negativo-suave text-negativo"
                          }`}
                        >
                          {evento.sucesso ? "sucesso" : "falha"}
                        </span>
                      </td>
                    </tr>

                    {aberto && (
                      <tr key={`${evento.id}-detalhe`}>
                        <td colSpan={7} className="bg-cartao-alt">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <p className="eyebrow mb-2">Antes → depois</p>
                              <Diferenca evento={evento} />
                            </div>
                            <div>
                              <p className="eyebrow mb-2">Payload enviado ao Omie</p>
                              <pre className="mono max-h-[190px] overflow-auto rounded-md border border-borda bg-cartao p-2 text-[11px]">
                                {JSON.stringify(evento.payloadEnviado, null, 2)}
                              </pre>
                              {evento.respostaOmie != null && (
                                <>
                                  <p className="eyebrow mt-2 mb-1">Resposta do Omie</p>
                                  <pre className="mono max-h-[120px] overflow-auto rounded-md border border-borda bg-cartao p-2 text-[11px]">
                                    {JSON.stringify(evento.respostaOmie, null, 2)}
                                  </pre>
                                </>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}

              {eventos.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="mx-auto max-w-sm rounded-lg border border-dashed border-borda p-6">
                      <p className="text-[13.5px] font-semibold">Nenhum evento no filtro</p>
                      <p className="mt-1 text-[12.5px] text-fraco">
                        Cada lançamento no Omie gera um registro aqui.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

/** Mostra antes → depois quando o evento carrega os dois lados; senão resume o que houve. */
function Diferenca({ evento }: { evento: EventoAuditoria }) {
  const payload = evento.payloadEnviado as
    | { anterior?: Record<string, unknown> | null; novo?: Record<string, unknown> }
    | null;

  if (payload?.anterior && payload?.novo) {
    const campos = Object.keys(payload.novo).filter(
      (chave) =>
        JSON.stringify(payload.novo?.[chave]) !==
        JSON.stringify(payload.anterior?.[chave]),
    );

    return (
      <ul className="flex flex-col gap-1 text-[12px]">
        {campos.map((campo) => (
          <li key={campo} className="grid grid-cols-[130px_1fr_12px_1fr] items-baseline gap-1">
            <span className="text-fraco">{campo}</span>
            <span className="mono text-negativo">
              {String(payload.anterior?.[campo] ?? "—")}
            </span>
            <span className="text-fraco">→</span>
            <span className="mono text-positivo">{String(payload.novo?.[campo] ?? "—")}</span>
          </li>
        ))}
        {campos.length === 0 && <li className="text-fraco">Nenhum campo alterado.</li>}
      </ul>
    );
  }

  return <p className="text-[12px] text-suave">{evento.descricao}</p>;
}
