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
    const cabecalho = [
      "data",
      "usuario",
      "acao",
      "entidade",
      "descricao",
      "sucesso",
      "erro",
    ];
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
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Auditoria</h1>
          <p className="text-sm text-suave">
            {eventos.length} evento(s). Cada linha guarda o que foi enviado ao Omie e o que
            voltou.
          </p>
        </div>
        <button className="btn" onClick={exportarCsv}>
          Exportar CSV
        </button>
      </header>

      <section className="cartao grid gap-3 p-3 md:grid-cols-4">
        <div>
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
        <div>
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
        <div>
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
        <div>
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
      </section>

      <section className="cartao overflow-hidden">
        <div className="overflow-x-auto">
          <table className="tabela">
            <thead>
              <tr>
                <th>Data</th>
                <th>Usuário</th>
                <th>Ação</th>
                <th>Entidade</th>
                <th>Descrição</th>
                <th>Resultado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {eventos.map((evento) => (
                <tr key={evento.id}>
                  <td className="whitespace-nowrap">{dataHoraBr(evento.criadoEm)}</td>
                  <td>{evento.usuario}</td>
                  <td className="capitalize">{evento.acao.replace("_", " ")}</td>
                  <td className="font-mono text-xs">{evento.entidade}</td>
                  <td>
                    {evento.descricao}
                    {evento.erro && (
                      <div className="text-xs text-negativo">{evento.erro}</div>
                    )}
                    {expandido === evento.id && (
                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        <pre className="overflow-x-auto rounded-lg bg-cartao-alt p-2 text-xs">
                          {JSON.stringify(evento.payloadEnviado, null, 2)}
                        </pre>
                        <pre className="overflow-x-auto rounded-lg bg-cartao-alt p-2 text-xs">
                          {JSON.stringify(evento.respostaOmie, null, 2)}
                        </pre>
                      </div>
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
                      {evento.sucesso ? "ok" : "falha"}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn-mini"
                      onClick={() =>
                        setExpandido((atual) => (atual === evento.id ? null : evento.id))
                      }
                    >
                      {expandido === evento.id ? "Ocultar" : "Detalhes"}
                    </button>
                  </td>
                </tr>
              ))}

              {eventos.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-suave">
                    Nenhum evento no filtro atual.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
