import { ok, respostaErro } from "@/lib/api";
import { exigirSessaoApi } from "@/lib/auth";
import { aplicarImportacao, planejarImportacao } from "@/lib/importacao";
import { garantirGestor } from "@/lib/operacoes";

export async function GET() {
  try {
    await exigirSessaoApi();
    return ok(await planejarImportacao());
  } catch (erro) {
    return respostaErro(erro);
  }
}

export async function POST() {
  try {
    const sessao = await exigirSessaoApi();
    garantirGestor(sessao);
    return ok(await aplicarImportacao(sessao));
  } catch (erro) {
    return respostaErro(erro);
  }
}
