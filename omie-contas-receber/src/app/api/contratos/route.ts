import { corpo, ok, respostaErro } from "@/lib/api";
import { exigirSessaoApi } from "@/lib/auth";
import { descreverRegras } from "@/lib/desconto";
import { garantirGestor } from "@/lib/operacoes";
import {
  listarContratos,
  registrarEvento,
  salvarContrato,
  type EntradaContrato,
} from "@/lib/store";

export async function GET() {
  try {
    await exigirSessaoApi();
    return ok({ contratos: await listarContratos() });
  } catch (erro) {
    return respostaErro(erro);
  }
}

export async function POST(request: Request) {
  try {
    const sessao = await exigirSessaoApi();
    garantirGestor(sessao);

    const entrada = await corpo<EntradaContrato>(request);
    const anteriores = await listarContratos();
    const anterior = entrada.id ? anteriores.find((c) => c.id === entrada.id) : undefined;
    const contrato = await salvarContrato(entrada);

    await registrarEvento({
      usuario: sessao.usuario,
      acao: "contrato",
      entidade: `contrato:${contrato.id}`,
      descricao: anterior
        ? `Contrato de ${contrato.nome} atualizado: ${descreverRegras(anterior)} -> ${descreverRegras(contrato)}`
        : `Contrato criado para ${contrato.nome}: ${descreverRegras(contrato)}`,
      payloadEnviado: { anterior, novo: contrato },
      respostaOmie: null,
      sucesso: true,
      erro: null,
    });

    return ok({ contrato });
  } catch (erro) {
    return respostaErro(erro);
  }
}
