import { corpo, ok, respostaErro } from "@/lib/api";
import { exigirSessaoApi } from "@/lib/auth";
import { trocarContaCorrente } from "@/lib/operacoes";

export async function POST(request: Request) {
  try {
    const sessao = await exigirSessaoApi();
    const { tituloIds, contaCorrenteId } = await corpo<{
      tituloIds?: number[];
      contaCorrenteId?: number;
    }>(request);

    if (!tituloIds?.length) throw new Error("Selecione ao menos um título.");
    if (!contaCorrenteId) throw new Error("Selecione a conta corrente de destino.");

    const resultados = await trocarContaCorrente(sessao, tituloIds, contaCorrenteId);
    return ok({ resultados });
  } catch (erro) {
    return respostaErro(erro);
  }
}
