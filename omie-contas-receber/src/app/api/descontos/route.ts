import { corpo, ok, respostaErro } from "@/lib/api";
import { exigirSessaoApi } from "@/lib/auth";
import { aplicarDescontos, type EntradaDescontos } from "@/lib/operacoes";

export async function POST(request: Request) {
  try {
    const sessao = await exigirSessaoApi();
    const entrada = await corpo<EntradaDescontos>(request);
    const resultados = await aplicarDescontos(sessao, entrada);
    return ok({ resultados });
  } catch (erro) {
    return respostaErro(erro);
  }
}
