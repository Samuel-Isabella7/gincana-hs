import { corpo, ok, respostaErro } from "@/lib/api";
import { exigirSessaoApi } from "@/lib/auth";
import { decidirAprovacao, type DecisaoAprovacao } from "@/lib/operacoes";
import { listarAprovacoes } from "@/lib/store";
import type { StatusAprovacao } from "@/lib/types";

export async function GET(request: Request) {
  try {
    await exigirSessaoApi();
    const status = new URL(request.url).searchParams.get("status");
    return ok({
      aprovacoes: await listarAprovacoes((status as StatusAprovacao) || undefined),
    });
  } catch (erro) {
    return respostaErro(erro);
  }
}

export async function POST(request: Request) {
  try {
    const sessao = await exigirSessaoApi();
    const decisao = await corpo<DecisaoAprovacao>(request);
    if (!decisao.id) throw new Error("Solicitação não informada.");
    if (decisao.acao !== "aprovar" && decisao.acao !== "rejeitar") {
      throw new Error("Ação inválida.");
    }
    return ok(await decidirAprovacao(sessao, decisao));
  } catch (erro) {
    return respostaErro(erro);
  }
}
