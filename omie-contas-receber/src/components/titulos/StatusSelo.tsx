import type { StatusTitulo } from "@/lib/types";

const ESTILOS: Record<StatusTitulo, { rotulo: string; classe: string }> = {
  A_VENCER: { rotulo: "A vencer", classe: "bg-acento-suave text-acento" },
  VENCIDO: { rotulo: "Vencido", classe: "bg-negativo-suave text-negativo" },
  PARCIAL: { rotulo: "Parcial", classe: "bg-alerta-suave text-alerta" },
  RECEBIDO: { rotulo: "Recebido", classe: "bg-positivo-suave text-positivo" },
  CANCELADO: { rotulo: "Cancelado", classe: "bg-cartao-alt text-suave" },
};

export function StatusSelo({ status }: { status: StatusTitulo }) {
  const estilo = ESTILOS[status];
  return <span className={`selo ${estilo.classe}`}>{estilo.rotulo}</span>;
}

export const ROTULOS_STATUS = Object.entries(ESTILOS).map(([valor, e]) => ({
  valor: valor as StatusTitulo,
  rotulo: e.rotulo,
}));
