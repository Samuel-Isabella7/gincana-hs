import { corpo, ok, respostaErro } from "@/lib/api";
import { exigirSessaoApi } from "@/lib/auth";
import { aplicarBancoDoContrato } from "@/lib/operacoes";
import type { ItemBancoContrato } from "@/lib/operacoes-tipos";

export async function POST(request: Request) {
  try {
    const sessao = await exigirSessaoApi();
    const { itens } = await corpo<{ itens?: ItemBancoContrato[] }>(request);
    if (!itens?.length) throw new Error("Selecione ao menos um título.");
    return ok({ resultados: await aplicarBancoDoContrato(sessao, itens) });
  } catch (erro) {
    return respostaErro(erro);
  }
}
