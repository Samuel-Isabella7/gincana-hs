import { corpo, ok, respostaErro } from "@/lib/api";
import { criarSessao, encerrarSessao } from "@/lib/auth";
import { buscarUsuario, conferirSenha, registrarEvento } from "@/lib/store";

export async function POST(request: Request) {
  try {
    const { usuario, senha } = await corpo<{ usuario?: string; senha?: string }>(request);

    if (!usuario?.trim() || !senha) {
      throw new Error("Informe usuário e senha.");
    }

    const encontrado = await buscarUsuario(usuario.trim());
    if (!encontrado || !conferirSenha(senha, encontrado.senhaHash)) {
      await registrarEvento({
        usuario: usuario.trim(),
        acao: "login",
        entidade: "sessao",
        descricao: "Tentativa de login inválida",
        payloadEnviado: null,
        respostaOmie: null,
        sucesso: false,
        erro: "Usuário ou senha incorretos.",
      });
      throw new Error("Usuário ou senha incorretos.");
    }

    await criarSessao(encontrado);
    await registrarEvento({
      usuario: encontrado.usuario,
      acao: "login",
      entidade: "sessao",
      descricao: `Login realizado (${encontrado.perfil})`,
      payloadEnviado: null,
      respostaOmie: null,
      sucesso: true,
      erro: null,
    });

    return ok({ usuario: encontrado.usuario, nome: encontrado.nome, perfil: encontrado.perfil });
  } catch (erro) {
    return respostaErro(erro);
  }
}

export async function DELETE() {
  await encerrarSessao();
  return ok({ encerrada: true });
}
