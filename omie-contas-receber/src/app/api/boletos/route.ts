import { corpo, ok, respostaErro } from "@/lib/api";
import { exigirSessaoApi } from "@/lib/auth";
import { emitirBoletos } from "@/lib/operacoes";

export async function POST(request: Request) {
  try {
    const sessao = await exigirSessaoApi();
    const { tituloIds } = await corpo<{ tituloIds?: number[] }>(request);
    if (!tituloIds?.length) throw new Error("Selecione ao menos um título.");
    const resultados = await emitirBoletos(sessao, tituloIds);
    return ok({ resultados });
  } catch (erro) {
    return respostaErro(erro);
  }
}
