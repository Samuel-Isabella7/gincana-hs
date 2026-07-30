"use client";

import { moeda } from "@/lib/format";
import type { ResultadoItem } from "@/lib/types";

export interface ProgressoLote {
  atual: number;
  total: number;
  descricao?: string;
  rota?: string;
}

export function BarraProgresso({ progresso }: { progresso: ProgressoLote }) {
  const percentual = progresso.total
    ? Math.round((progresso.atual / progresso.total) * 100)
    : 0;

  return (
    <div className="py-6 text-center">
      <p className="mono text-[26px] leading-none font-semibold">
        {progresso.atual} de {progresso.total}
      </p>
      <div className="mx-auto mt-4 h-1.5 max-w-md overflow-hidden rounded-full bg-cartao-3">
        <div
          className="h-full rounded-full bg-acento transition-[width] duration-200"
          style={{ width: `${percentual}%` }}
        />
      </div>
      {progresso.descricao && (
        <p className="mt-3 text-[12.5px] text-suave">{progresso.descricao}</p>
      )}
      {progresso.rota && (
        <p className="mono mt-1 text-[11px] text-fraco">{progresso.rota}</p>
      )}
    </div>
  );
}

export function ResultadoLote({
  resultados,
  rotuloItem = "Título",
  onTentarNovamente,
}: {
  resultados: ResultadoItem[];
  rotuloItem?: string;
  onTentarNovamente?: (tituloId: number) => void;
}) {
  if (!resultados.length) return null;

  const pendentes = resultados.filter((r) => r.pendente);
  const sucessos = resultados.filter((r) => r.sucesso && !r.pendente);
  const falhas = resultados.filter((r) => !r.sucesso);

  return (
    <div>
      <div className="mb-3.5 grid gap-2.5 sm:grid-cols-3">
        <Cartao
          rotulo="Gravados com sucesso"
          valor={sucessos.length}
          fundo="var(--pos-soft)"
          cor="var(--pos)"
        />
        <Cartao
          rotulo="Em aprovação"
          valor={pendentes.length}
          fundo="var(--warn-soft)"
          cor="var(--warn)"
        />
        <Cartao
          rotulo="Falhas"
          valor={falhas.length}
          fundo="var(--neg-soft)"
          cor="var(--neg)"
        />
      </div>

      <ul className="flex flex-col gap-1.5">
        {resultados.map((resultado) => {
          const cor = resultado.pendente
            ? "border-alerta/40 bg-alerta-suave"
            : resultado.sucesso
              ? "border-borda bg-cartao-alt"
              : "border-negativo/40 bg-negativo-suave";
          return (
            <li
              key={`${resultado.tituloId}-${resultado.mensagem}`}
              className={`rounded-md border px-2.5 py-2 text-[12.5px] ${cor}`}
            >
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="mono font-medium">
                  {rotuloItem} {resultado.tituloId}
                </span>
                <span
                  className={
                    resultado.pendente
                      ? "text-alerta"
                      : resultado.sucesso
                        ? "text-suave"
                        : "text-negativo"
                  }
                >
                  {resultado.mensagem}
                </span>
                {!resultado.sucesso && onTentarNovamente && (
                  <button
                    className="btn-mini ml-auto"
                    onClick={() => onTentarNovamente(resultado.tituloId)}
                  >
                    Tentar novamente
                  </button>
                )}
              </div>
              <Detalhe resultado={resultado} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Cartao({
  rotulo,
  valor,
  fundo,
  cor,
}: {
  rotulo: string;
  valor: number;
  fundo: string;
  cor: string;
}) {
  return (
    <div className="rounded-md px-3 py-2.5" style={{ background: fundo }}>
      <p className="eyebrow" style={{ color: cor }}>
        {rotulo}
      </p>
      <p className="mono text-[21px] leading-none font-semibold" style={{ color: cor }}>
        {valor}
      </p>
    </div>
  );
}

function Detalhe({ resultado }: { resultado: ResultadoItem }) {
  const detalhe = resultado.detalhe as
    | {
        link?: string | null;
        linhaDigitavel?: string | null;
        desconto?: number;
        saldoFinal?: number;
      }
    | undefined;

  if (!detalhe) return null;

  const temBoleto = detalhe.link || detalhe.linhaDigitavel;
  if (!temBoleto && detalhe.desconto == null) return null;

  return (
    <div className="mt-1 flex flex-wrap items-center gap-3 text-[11.5px]">
      {detalhe.desconto != null && (
        <span className="mono text-fraco">
          desconto {moeda(detalhe.desconto)} · restou {moeda(detalhe.saldoFinal ?? 0)}
        </span>
      )}
      {detalhe.linhaDigitavel && (
        <span className="mono max-w-[280px] truncate text-fraco">
          {detalhe.linhaDigitavel}
        </span>
      )}
      {detalhe.linhaDigitavel && (
        <button
          type="button"
          className="btn-mini"
          onClick={() => navigator.clipboard?.writeText(detalhe.linhaDigitavel!)}
        >
          Copiar linha
        </button>
      )}
      {detalhe.link && (
        <a href={detalhe.link} target="_blank" rel="noopener noreferrer">
          PDF ↓
        </a>
      )}
    </div>
  );
}
