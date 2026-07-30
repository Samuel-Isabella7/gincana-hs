import { percentual } from "@/lib/format";
import type { Contrato } from "@/lib/types";

/**
 * Resume o contrato em um selo: percentual único, faixa de percentuais quando
 * há mais de uma regra, ou "banco fixo" para quem só tem conta obrigatória.
 */
export function SeloContrato({ contrato }: { contrato: Contrato }) {
  if (!contrato.regras.length) {
    return <span className="selo-contrato">Banco fixo</span>;
  }

  const percentuais = contrato.regras.map((r) => r.percentual);
  const minimo = Math.min(...percentuais);
  const maximo = Math.max(...percentuais);

  return (
    <span className="selo-contrato" title={contrato.regras.map((r) => `${r.rotulo}: ${r.percentual}%`).join(" · ")}>
      Contrato −
      {minimo === maximo
        ? percentual(minimo)
        : `${percentual(minimo)}…${percentual(maximo)}`}
    </span>
  );
}
