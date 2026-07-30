import type { ResultadoItem } from "./types";

/**
 * Executa uma operação item a item (o Omie não aceita rajadas de chamadas) e
 * informa o progresso a cada conclusão, para a tela mostrar "x de y".
 */
export async function enviarSequencial<T>(
  itens: T[],
  idDe: (item: T) => number,
  enviar: (item: T) => Promise<ResultadoItem[]>,
  aoProgredir?: (concluidos: number) => void,
): Promise<ResultadoItem[]> {
  const resultados: ResultadoItem[] = [];

  for (let i = 0; i < itens.length; i++) {
    const item = itens[i];
    try {
      resultados.push(...(await enviar(item)));
    } catch (erro) {
      resultados.push({
        tituloId: idDe(item),
        sucesso: false,
        mensagem: erro instanceof Error ? erro.message : String(erro),
      });
    }
    aoProgredir?.(i + 1);
  }

  return resultados;
}

export async function postJson<T>(url: string, corpo: unknown): Promise<T> {
  const resposta = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new Error((dados as { erro?: string }).erro ?? `Falha na requisição (${resposta.status}).`);
  }
  return dados as T;
}
