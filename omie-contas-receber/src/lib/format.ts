const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const NUM = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function moeda(valor: number | null | undefined): string {
  return BRL.format(valor ?? 0);
}

export function numero(valor: number | null | undefined): string {
  return NUM.format(valor ?? 0);
}

export function percentual(valor: number | null | undefined): string {
  return `${NUM.format(valor ?? 0)}%`;
}

/** Arredonda para 2 casas (meio para cima), evitando ruído de ponto flutuante. */
export function round2(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

/** Trunca para 2 casas — usado no desconto, que nunca arredonda a favor do cliente. */
export function floor2(valor: number): number {
  return Math.floor(round2(valor * 100)) / 100;
}

/** yyyy-mm-dd -> dd/mm/yyyy (formato aceito pelo Omie). */
export function paraDataOmie(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

/** dd/mm/yyyy -> yyyy-mm-dd. */
export function deDataOmie(br: string | null | undefined): string {
  if (!br) return "";
  const [dia, mes, ano] = br.split("/");
  if (!ano) return "";
  return `${ano}-${mes}-${dia}`;
}

/** yyyy-mm-dd -> dd/mm/yyyy para exibição. */
export function dataBr(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.split("-");
  if (!dia) return iso;
  return `${dia}/${mes}/${ano}`;
}

export function dataHoraBr(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Soma dias a uma data ISO sem sofrer com fuso horário. */
export function somarDias(iso: string, dias: number): string {
  const [ano, mes, dia] = iso.split("-").map(Number);
  const base = Date.UTC(ano, mes - 1, dia) + dias * 86_400_000;
  return new Date(base).toISOString().slice(0, 10);
}

export function formatarCnpj(valor: string | null | undefined): string {
  const d = (valor ?? "").replace(/\D/g, "");
  if (d.length === 14) {
    return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }
  if (d.length === 11) {
    return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }
  return valor ?? "—";
}

export function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}
