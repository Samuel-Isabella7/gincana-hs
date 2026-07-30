import { ok, respostaErro } from "@/lib/api";
import { exigirSessaoApi } from "@/lib/auth";
import { garantirGestor } from "@/lib/operacoes";
import { excluirContrato, listarContratos, registrarEvento } from "@/lib/store";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const sessao = await exigirSessaoApi();
    garantirGestor(sessao);

    const { id } = await params;
    const contrato = (await listarContratos()).find((c) => c.id === id);
    await excluirContrato(id);

    await registrarEvento({
      usuario: sessao.usuario,
      acao: "contrato",
      entidade: `contrato:${id}`,
      descricao: `Contrato removido${contrato ? ` (${contrato.nome})` : ""}`,
      payloadEnviado: contrato ?? { id },
      respostaOmie: null,
      sucesso: true,
      erro: null,
    });

    return ok({ removido: true });
  } catch (erro) {
    return respostaErro(erro);
  }
}
