import { corpo, ok, respostaErro } from "@/lib/api";
import { exigirSessaoApi } from "@/lib/auth";
import { parcelarTitulo, type EntradaParcelamento } from "@/lib/operacoes";

export async function POST(request: Request) {
  try {
    const sessao = await exigirSessaoApi();
    const entrada = await corpo<EntradaParcelamento>(request);
    if (!entrada.tituloId) throw new Error("Título não informado.");
    const resultado = await parcelarTitulo(sessao, entrada);
    return ok(resultado);
  } catch (erro) {
    return respostaErro(erro);
  }
}
