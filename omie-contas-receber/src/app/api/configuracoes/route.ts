import { corpo, ok, respostaErro } from "@/lib/api";
import { exigirSessaoApi } from "@/lib/auth";
import { garantirGestor } from "@/lib/operacoes";
import { lerConfig, salvarConfig } from "@/lib/store";
import type { Config } from "@/lib/types";

export async function GET() {
  try {
    await exigirSessaoApi();
    return ok({ config: await lerConfig() });
  } catch (erro) {
    return respostaErro(erro);
  }
}

export async function POST(request: Request) {
  try {
    const sessao = await exigirSessaoApi();
    garantirGestor(sessao);

    const parcial = await corpo<Partial<Config>>(request);
    const config = await salvarConfig({
      pisoSaldo: parcial.pisoSaldo != null ? Number(parcial.pisoSaldo) : undefined,
      limiteDescontoManual:
        parcial.limiteDescontoManual != null ? Number(parcial.limiteDescontoManual) : undefined,
      contaCorrentePadrao:
        parcial.contaCorrentePadrao != null ? Number(parcial.contaCorrentePadrao) : null,
    });

    return ok({ config });
  } catch (erro) {
    return respostaErro(erro);
  }
}
