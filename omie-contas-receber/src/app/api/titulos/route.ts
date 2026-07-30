import { ok, respostaErro } from "@/lib/api";
import { exigirSessaoApi } from "@/lib/auth";
import { listarTitulos } from "@/lib/omie/service";
import { listarContratos } from "@/lib/store";

export async function GET(request: Request) {
  try {
    await exigirSessaoApi();
    const url = new URL(request.url);

    const [pagina, contratos] = await Promise.all([
      listarTitulos({
        pagina: Number(url.searchParams.get("pagina") ?? 1),
        registrosPorPagina: Number(url.searchParams.get("porPagina") ?? 50),
        clienteId: url.searchParams.get("cliente")
          ? Number(url.searchParams.get("cliente"))
          : undefined,
        venceDe: url.searchParams.get("venceDe") ?? undefined,
        venceAte: url.searchParams.get("venceAte") ?? undefined,
      }),
      listarContratos(),
    ]);

    return ok({ ...pagina, contratos });
  } catch (erro) {
    return respostaErro(erro);
  }
}
