import { ok, respostaErro } from "@/lib/api";
import { exigirSessaoApi } from "@/lib/auth";
import { limparCacheOmie, testarConexao } from "@/lib/omie/service";

export async function GET() {
  try {
    await exigirSessaoApi();
    limparCacheOmie();
    return ok(await testarConexao());
  } catch (erro) {
    return respostaErro(erro);
  }
}
