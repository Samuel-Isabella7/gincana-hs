import "server-only";
import { NaoAutorizado } from "./auth";
import { mensagemErro } from "./omie/client";

export function respostaErro(erro: unknown) {
  const status = erro instanceof NaoAutorizado ? 401 : 400;
  return Response.json({ erro: mensagemErro(erro) }, { status });
}

export function ok<T>(dados: T) {
  return Response.json(dados);
}

export async function corpo<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new Error("Corpo da requisição inválido.");
  }
}
