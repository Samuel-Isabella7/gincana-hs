import { ok, respostaErro } from "@/lib/api";
import { exigirSessaoApi } from "@/lib/auth";
import { listarClientes } from "@/lib/omie/service";

export async function GET(request: Request) {
  try {
    await exigirSessaoApi();
    const busca = (new URL(request.url).searchParams.get("busca") ?? "")
      .trim()
      .toLowerCase();

    const clientes = await listarClientes();
    const filtrados = busca
      ? clientes.filter(
          (c) => c.nome.toLowerCase().includes(busca) || c.cnpj.includes(busca.replace(/\D/g, "")),
        )
      : clientes;

    return ok({ clientes: filtrados.slice(0, 50) });
  } catch (erro) {
    return respostaErro(erro);
  }
}
