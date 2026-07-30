import "server-only";
import { randomUUID } from "node:crypto";
import lista from "@/dados/contratos-kalena.json";
import type { Sessao } from "./auth";
import { descreverRegras } from "./desconto";
import { listarClientes, listarContasCorrentes } from "./omie/service";
import { listarContratos, registrarEvento, salvarContrato } from "./store";
import type { CategoriaProduto, ClienteResumo, ContaCorrente, RegraDesconto } from "./types";

interface ContratoArquivo {
  nome: string;
  cnpj?: string;
  grupo?: string | null;
  banco: string;
  observacoes?: string;
  regras: Array<{
    rotulo: string;
    categoria: CategoriaProduto;
    uf: string | null;
    percentual: number;
  }>;
}

export type SituacaoImportacao =
  | "novo"
  | "atualiza"
  | "sem-alteracao"
  | "cliente-ambiguo"
  | "cliente-nao-encontrado"
  | "conta-nao-encontrada";

export interface LinhaImportacao {
  nome: string;
  grupo: string | null;
  banco: string;
  regras: string;
  situacao: SituacaoImportacao;
  detalhe: string;
  clienteId: number | null;
  clienteNome: string | null;
  cnpj: string | null;
  contaCorrenteId: number | null;
  contaCorrenteNome: string | null;
}

const SUFIXOS =
  /\b(ltda|s\/?a|sa|me|epp|eireli|cia|companhia|comercios?|com|industria|distribuidoras?|dist|supermercados?|super|mercados?|alimentos?|alimentacao|refeicoes|hortifruti)\b/g;

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function chaveComparavel(texto: string): string {
  return normalizar(texto).replace(SUFIXOS, "").replace(/\s+/g, " ").trim();
}

function acharClientes(entrada: ContratoArquivo, clientes: ClienteResumo[]): ClienteResumo[] {
  if (entrada.cnpj) {
    const digitos = entrada.cnpj.replace(/\D/g, "");
    const porCnpj = clientes.filter((c) => c.cnpj === digitos);
    if (porCnpj.length) return porCnpj;
  }

  const alvo = chaveComparavel(entrada.nome);
  if (!alvo) return [];

  const exatos = clientes.filter((c) => chaveComparavel(c.nome) === alvo);
  if (exatos.length) return exatos;

  return clientes.filter((c) => {
    const nome = chaveComparavel(c.nome);
    return nome.includes(alvo) || alvo.includes(nome);
  });
}

function acharConta(banco: string, contas: ContaCorrente[]): ContaCorrente | null {
  const alvo = normalizar(banco);
  const termos = alvo.split(" ").filter(Boolean);

  const exata = contas.find((c) => normalizar(c.descricao) === alvo);
  if (exata) return exata;

  const candidatas = contas.filter((c) => {
    const texto = normalizar(`${c.descricao} ${c.banco ?? ""}`);
    return termos.every((termo) => texto.includes(termo));
  });
  if (candidatas.length === 1) return candidatas[0];

  // Só o nome do banco (ex: "daycoval") já resolve quando existe uma única conta dele.
  const soBanco = contas.filter((c) =>
    normalizar(`${c.descricao} ${c.banco ?? ""}`).includes(termos[0] ?? alvo),
  );
  return soBanco.length === 1 ? soBanco[0] : (candidatas[0] ?? null);
}

function mesmasRegras(atuais: RegraDesconto[], novas: ContratoArquivo["regras"]): boolean {
  if (atuais.length !== novas.length) return false;
  return novas.every((nova) =>
    atuais.some(
      (atual) =>
        atual.categoria === nova.categoria &&
        (atual.uf ?? null) === (nova.uf ?? null) &&
        Math.abs(atual.percentual - nova.percentual) < 0.001,
    ),
  );
}

/** Compara a lista do arquivo com o que já está cadastrado, sem gravar nada. */
export async function planejarImportacao(): Promise<{
  linhas: LinhaImportacao[];
  atualizadoEm: string;
}> {
  const arquivo = lista as { atualizadoEm: string; contratos: ContratoArquivo[] };
  const [clientes, contas, contratos] = await Promise.all([
    listarClientes(),
    listarContasCorrentes(),
    listarContratos(),
  ]);

  const linhas = arquivo.contratos.map<LinhaImportacao>((entrada) => {
    const encontrados = acharClientes(entrada, clientes);
    const conta = acharConta(entrada.banco, contas);
    const regrasTexto = entrada.regras.length
      ? entrada.regras
          .map((r) => `${r.rotulo} ${r.percentual.toFixed(2).replace(".", ",")}%`)
          .join(" · ")
      : "sem desconto (só banco)";

    const base = {
      nome: entrada.nome,
      grupo: entrada.grupo ?? null,
      banco: entrada.banco,
      regras: regrasTexto,
      clienteId: encontrados[0]?.id ?? null,
      clienteNome: encontrados[0]?.nome ?? null,
      cnpj: encontrados[0]?.cnpj ?? null,
      contaCorrenteId: conta?.id ?? null,
      contaCorrenteNome: conta?.descricao ?? null,
    };

    if (encontrados.length === 0) {
      return {
        ...base,
        situacao: "cliente-nao-encontrado",
        detalhe: "Nenhum cliente do Omie com este nome. Cadastre manualmente ou ajuste o nome.",
      };
    }
    if (encontrados.length > 1) {
      return {
        ...base,
        situacao: "cliente-ambiguo",
        detalhe: `${encontrados.length} clientes parecidos no Omie: ${encontrados
          .slice(0, 3)
          .map((c) => c.nome)
          .join(", ")}${encontrados.length > 3 ? "…" : ""}`,
      };
    }
    if (!conta) {
      return {
        ...base,
        situacao: "conta-nao-encontrada",
        detalhe: `Nenhuma conta corrente do Omie corresponde a "${entrada.banco}".`,
      };
    }

    const existente = contratos.find((c) => c.omieClienteId === encontrados[0].id);
    if (!existente) {
      return { ...base, situacao: "novo", detalhe: "Será criado." };
    }
    if (
      mesmasRegras(existente.regras, entrada.regras) &&
      existente.contaCorrentePreferencial === conta.id
    ) {
      return { ...base, situacao: "sem-alteracao", detalhe: "Já cadastrado igual." };
    }
    return {
      ...base,
      situacao: "atualiza",
      detalhe: `Atual: ${descreverRegras(existente)}.`,
    };
  });

  return { linhas, atualizadoEm: arquivo.atualizadoEm };
}

/** Grava os contratos que o planejamento marcou como novos ou desatualizados. */
export async function aplicarImportacao(sessao: Sessao): Promise<{
  criados: number;
  atualizados: number;
  ignorados: LinhaImportacao[];
}> {
  const arquivo = lista as { contratos: ContratoArquivo[] };
  const { linhas } = await planejarImportacao();

  let criados = 0;
  let atualizados = 0;
  const ignorados: LinhaImportacao[] = [];

  for (const linha of linhas) {
    if (linha.situacao === "sem-alteracao") continue;
    if (linha.situacao !== "novo" && linha.situacao !== "atualiza") {
      ignorados.push(linha);
      continue;
    }

    const entrada = arquivo.contratos.find((c) => c.nome === linha.nome)!;
    const contratos = await listarContratos();
    const existente = contratos.find((c) => c.omieClienteId === linha.clienteId);

    await salvarContrato({
      id: existente?.id,
      omieClienteId: linha.clienteId!,
      nome: linha.clienteNome ?? entrada.nome,
      cnpj: linha.cnpj ?? "",
      grupo: entrada.grupo ?? null,
      regras: entrada.regras.map((regra) => ({
        id: randomUUID(),
        rotulo: regra.rotulo,
        percentual: regra.percentual,
        categoria: regra.categoria,
        uf: regra.uf,
        padrao: entrada.regras.length === 1,
      })),
      vigenciaInicio: null,
      vigenciaFim: null,
      tetoDesconto: null,
      contaCorrentePreferencial: linha.contaCorrenteId,
      aplicarContaSempre: true,
      ativo: true,
      observacoes: entrada.observacoes ?? null,
    });

    if (existente) atualizados += 1;
    else criados += 1;
  }

  await registrarEvento({
    usuario: sessao.usuario,
    acao: "contrato",
    entidade: "contrato:importacao",
    descricao: `Importação da lista de clientes especiais: ${criados} criado(s), ${atualizados} atualizado(s), ${ignorados.length} pendente(s)`,
    payloadEnviado: { ignorados },
    respostaOmie: null,
    sucesso: true,
    erro: null,
  });

  return { criados, atualizados, ignorados };
}
