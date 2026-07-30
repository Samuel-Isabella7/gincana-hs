"use client";

import type { ResultadoItem } from "@/lib/types";

export interface ProgressoLote {
  atual: number;
  total: number;
}

export function BarraProgresso({ progresso }: { progresso: ProgressoLote }) {
  const percentual = progresso.total
    ? Math.round((progresso.atual / progresso.total) * 100)
    : 0;

  return (
    <div className="mb-4">
      <div className="mb-1 flex justify-between text-xs text-suave">
        <span>
          Processando {progresso.atual} de {progresso.total}
        </span>
        <span>{percentual}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-cartao-alt">
        <div
          className="h-full rounded-full bg-acento transition-all"
          style={{ width: `${percentual}%` }}
        />
      </div>
    </div>
  );
}

export function ResultadoLote({
  resultados,
  rotuloItem = "Título",
}: {
  resultados: ResultadoItem[];
  rotuloItem?: string;
}) {
  if (!resultados.length) return null;

  const sucessos = resultados.filter((r) => r.sucesso).length;
  const falhas = resultados.length - sucessos;

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2 text-sm">
        <span className="selo bg-positivo-suave text-positivo">
          {sucessos} concluído(s)
        </span>
        {falhas > 0 && (
          <span className="selo bg-negativo-suave text-negativo">{falhas} com falha</span>
        )}
      </div>

      <ul className="space-y-2">
        {resultados.map((resultado) => (
          <li
            key={resultado.tituloId}
            className={`rounded-lg border px-3 py-2 text-sm ${
              resultado.sucesso
                ? "border-borda bg-cartao-alt"
                : "border-negativo/40 bg-negativo-suave"
            }`}
          >
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-medium">
                {rotuloItem} {resultado.tituloId}
              </span>
              <span className={resultado.sucesso ? "text-suave" : "text-negativo"}>
                {resultado.mensagem}
              </span>
            </div>
            {detalheBoleto(resultado)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function detalheBoleto(resultado: ResultadoItem) {
  const detalhe = resultado.detalhe as
    | { link?: string | null; linhaDigitavel?: string | null }
    | undefined;
  if (!detalhe?.link && !detalhe?.linhaDigitavel) return null;

  return (
    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs">
      {detalhe.link && (
        <a
          href={detalhe.link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-acento underline"
        >
          Abrir boleto
        </a>
      )}
      {detalhe.linhaDigitavel && (
        <button
          type="button"
          className="btn-mini"
          onClick={() => navigator.clipboard?.writeText(detalhe.linhaDigitavel!)}
        >
          Copiar linha digitável
        </button>
      )}
    </div>
  );
}
