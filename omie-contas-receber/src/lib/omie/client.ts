import "server-only";

const BASE_URL = process.env.OMIE_BASE_URL ?? "https://app.omie.com.br/api/v1";
const TIMEOUT_MS = Number(process.env.OMIE_TIMEOUT_MS ?? 30_000);
const TENTATIVAS = 3;
/** O Omie limita chamadas simultâneas por app_key, então serializamos as requisições. */
const INTERVALO_MINIMO_MS = Number(process.env.OMIE_INTERVALO_MS ?? 260);

export class OmieError extends Error {
  constructor(
    message: string,
    readonly codigo: string | null = null,
    readonly status: number | null = null,
  ) {
    super(message);
    this.name = "OmieError";
  }
}

export function omieConfigurado(): boolean {
  return Boolean(process.env.OMIE_APP_KEY && process.env.OMIE_APP_SECRET);
}

let fila: Promise<unknown> = Promise.resolve();

function enfileirar<T>(tarefa: () => Promise<T>): Promise<T> {
  const resultado = fila.then(tarefa, tarefa);
  fila = resultado.then(
    () => esperar(INTERVALO_MINIMO_MS),
    () => esperar(INTERVALO_MINIMO_MS),
  );
  return resultado;
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Falhas transitórias do Omie (concorrência / limite de consumo) valem nova tentativa. */
function erroTemporario(mensagem: string): boolean {
  const m = mensagem.toLowerCase();
  return (
    m.includes("processos simultâneos") ||
    m.includes("processos simultaneos") ||
    m.includes("consumo") ||
    m.includes("tente novamente")
  );
}

/**
 * Executa uma chamada da API Omie.
 *
 * @param recurso caminho do recurso, ex: "financas/contareceber"
 * @param call    nome do método, ex: "ListarContasReceber"
 * @param param   objeto de parâmetros (o Omie sempre recebe um array de 1 item)
 */
export async function chamarOmie<T>(
  recurso: string,
  call: string,
  param: Record<string, unknown>,
): Promise<T> {
  if (!omieConfigurado()) {
    throw new OmieError(
      "Credenciais do Omie não configuradas (OMIE_APP_KEY / OMIE_APP_SECRET).",
    );
  }

  const corpo = JSON.stringify({
    call,
    app_key: process.env.OMIE_APP_KEY,
    app_secret: process.env.OMIE_APP_SECRET,
    param: [param],
  });

  let ultimoErro: unknown;

  for (let tentativa = 0; tentativa < TENTATIVAS; tentativa++) {
    if (tentativa > 0) await esperar(500 * 2 ** (tentativa - 1));

    try {
      return await enfileirar(async () => {
        const resposta = await fetch(`${BASE_URL}/${recurso}/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: corpo,
          cache: "no-store",
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });

        const texto = await resposta.text();
        let dados: unknown;
        try {
          dados = texto ? JSON.parse(texto) : null;
        } catch {
          throw new OmieError(
            `Resposta inválida do Omie (HTTP ${resposta.status}): ${texto.slice(0, 200)}`,
            null,
            resposta.status,
          );
        }

        const falha = dados as { faultstring?: string; faultcode?: string } | null;
        if (falha?.faultstring) {
          throw new OmieError(
            falha.faultstring.trim(),
            falha.faultcode ?? null,
            resposta.status,
          );
        }

        if (!resposta.ok) {
          throw new OmieError(
            `Omie retornou HTTP ${resposta.status} em ${call}.`,
            null,
            resposta.status,
          );
        }

        return dados as T;
      });
    } catch (erro) {
      ultimoErro = erro;

      if (erro instanceof OmieError) {
        const status = erro.status ?? 0;
        const vaiRepetir =
          erroTemporario(erro.message) || status === 429 || status >= 502;
        if (!vaiRepetir) throw erro;
      }
    }
  }

  if (ultimoErro instanceof OmieError) throw ultimoErro;
  throw new OmieError(
    `Falha ao chamar ${call} no Omie: ${
      ultimoErro instanceof Error ? ultimoErro.message : String(ultimoErro)
    }`,
  );
}

export function mensagemErro(erro: unknown): string {
  if (erro instanceof OmieError) return erro.message;
  if (erro instanceof Error) return erro.message;
  return String(erro);
}
