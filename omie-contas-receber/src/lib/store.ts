import "server-only";
import { randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  AcaoAuditoria,
  Aprovacao,
  Config,
  Contrato,
  EventoAuditoria,
  Perfil,
  RegistroParcelamento,
  RegraDesconto,
  StatusAprovacao,
  Usuario,
} from "./types";

/**
 * Persistência dos dados próprios do sistema (contratos, auditoria, config e
 * usuários). Usa Supabase quando as variáveis estão configuradas; caso
 * contrário grava em um JSON local, o que mantém o app utilizável em
 * desenvolvimento e no modo demonstração.
 */

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY;

let supabase: SupabaseClient | null = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
  });
}

export const usandoSupabase = () => supabase !== null;

export const CONFIG_PADRAO: Config = {
  pisoSaldo: 0,
  limiteDescontoManual: 500,
  contaCorrentePadrao: null,
};

// ------------------------------------------------------------- arquivo local

interface ArquivoLocal {
  contratos: Contrato[];
  auditoria: EventoAuditoria[];
  config: Partial<Config>;
  usuarios: Usuario[];
  aprovacoes: Aprovacao[];
  parcelamentos: RegistroParcelamento[];
}

/** Sempre dentro de ./.data para não arrastar o projeto inteiro no build. */
function caminhoLocal(): string {
  return path.join(process.cwd(), ".data", "store.json");
}

const VAZIO: ArquivoLocal = {
  contratos: [],
  auditoria: [],
  config: {},
  usuarios: [],
  aprovacoes: [],
  parcelamentos: [],
};

let escrevendo: Promise<unknown> = Promise.resolve();

async function lerLocal(): Promise<ArquivoLocal> {
  try {
    const conteudo = await fs.readFile(caminhoLocal(), "utf8");
    return { ...VAZIO, ...(JSON.parse(conteudo) as ArquivoLocal) };
  } catch {
    return { ...VAZIO };
  }
}

/** Serializa as escritas para não perder dados em requisições concorrentes. */
function gravarLocal<T>(mutacao: (dados: ArquivoLocal) => Promise<T> | T): Promise<T> {
  const proximo = escrevendo.then(async () => {
    const dados = await lerLocal();
    const resultado = await mutacao(dados);
    const destino = caminhoLocal();
    await fs.mkdir(path.dirname(destino), { recursive: true });
    await fs.writeFile(destino, JSON.stringify(dados, null, 2), "utf8");
    return resultado;
  });
  escrevendo = proximo.catch(() => undefined);
  return proximo;
}

// ------------------------------------------------------------------ contratos

interface ContratoRow {
  id: string;
  omie_cliente_id: number;
  nome: string;
  cnpj: string;
  grupo: string | null;
  regras: RegraDesconto[];
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  teto_desconto: number | null;
  conta_corrente_preferencial: number | null;
  aplicar_conta_sempre: boolean;
  ativo: boolean;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
}

function paraContrato(row: ContratoRow): Contrato {
  return {
    id: row.id,
    omieClienteId: Number(row.omie_cliente_id),
    nome: row.nome,
    cnpj: row.cnpj ?? "",
    grupo: row.grupo,
    regras: (row.regras ?? []).map((regra) => ({
      ...regra,
      percentual: Number(regra.percentual),
    })),
    vigenciaInicio: row.vigencia_inicio,
    vigenciaFim: row.vigencia_fim,
    tetoDesconto: row.teto_desconto != null ? Number(row.teto_desconto) : null,
    contaCorrentePreferencial:
      row.conta_corrente_preferencial != null
        ? Number(row.conta_corrente_preferencial)
        : null,
    aplicarContaSempre: Boolean(row.aplicar_conta_sempre),
    ativo: Boolean(row.ativo),
    observacoes: row.observacoes,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
  };
}

function paraRow(contrato: Contrato): ContratoRow {
  return {
    id: contrato.id,
    omie_cliente_id: contrato.omieClienteId,
    nome: contrato.nome,
    cnpj: contrato.cnpj,
    grupo: contrato.grupo,
    regras: contrato.regras,
    vigencia_inicio: contrato.vigenciaInicio,
    vigencia_fim: contrato.vigenciaFim,
    teto_desconto: contrato.tetoDesconto,
    conta_corrente_preferencial: contrato.contaCorrentePreferencial,
    aplicar_conta_sempre: contrato.aplicarContaSempre,
    ativo: contrato.ativo,
    observacoes: contrato.observacoes,
    criado_em: contrato.criadoEm,
    atualizado_em: contrato.atualizadoEm,
  };
}

export async function listarContratos(): Promise<Contrato[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from("contratos")
      .select("*")
      .order("nome", { ascending: true });
    if (error) throw new Error(`Supabase (contratos): ${error.message}`);
    return (data as ContratoRow[]).map(paraContrato);
  }
  const dados = await lerLocal();
  return dados.contratos.sort((a, b) => a.nome.localeCompare(b.nome));
}

export type EntradaContrato = Omit<
  Contrato,
  "id" | "criadoEm" | "atualizadoEm" | "regras" | "aplicarContaSempre" | "grupo"
> & {
  id?: string;
  grupo?: string | null;
  regras?: Array<Partial<RegraDesconto> & { percentual: number }>;
  aplicarContaSempre?: boolean;
};

export async function salvarContrato(entrada: EntradaContrato): Promise<Contrato> {
  validarContrato(entrada);

  const existentes = await listarContratos();
  const conflito = existentes.find(
    (c) =>
      c.id !== entrada.id &&
      c.omieClienteId === entrada.omieClienteId &&
      c.ativo &&
      entrada.ativo &&
      periodosSobrepostos(c, entrada),
  );
  if (conflito) {
    throw new Error(
      "Já existe um contrato ativo vigente para este cliente no período informado.",
    );
  }

  const agora = new Date().toISOString();
  const anterior = entrada.id ? existentes.find((c) => c.id === entrada.id) : undefined;
  const contrato: Contrato = {
    id: entrada.id ?? randomUUID(),
    omieClienteId: entrada.omieClienteId,
    nome: entrada.nome.trim(),
    cnpj: (entrada.cnpj ?? "").replace(/\D/g, ""),
    grupo: entrada.grupo?.trim() || null,
    regras: (entrada.regras ?? []).map((regra) => ({
      id: regra.id || randomUUID(),
      rotulo: regra.rotulo?.trim() || rotuloPadrao(regra),
      percentual: Number(regra.percentual),
      categoria: regra.categoria ?? "geral",
      uf: regra.uf?.trim()?.toUpperCase() || null,
      padrao: Boolean(regra.padrao),
    })),
    vigenciaInicio: entrada.vigenciaInicio || null,
    vigenciaFim: entrada.vigenciaFim || null,
    tetoDesconto: entrada.tetoDesconto != null ? Number(entrada.tetoDesconto) : null,
    contaCorrentePreferencial: entrada.contaCorrentePreferencial ?? null,
    aplicarContaSempre: entrada.aplicarContaSempre ?? true,
    ativo: entrada.ativo,
    observacoes: entrada.observacoes?.trim() || null,
    criadoEm: anterior?.criadoEm ?? agora,
    atualizadoEm: agora,
  };

  // Uma única regra é sempre a padrão; com várias, garante no máximo uma marcada.
  if (contrato.regras.length === 1) contrato.regras[0].padrao = true;
  else {
    let jaTemPadrao = false;
    for (const regra of contrato.regras) {
      if (regra.padrao && !jaTemPadrao) jaTemPadrao = true;
      else regra.padrao = false;
    }
  }

  if (supabase) {
    const { error } = await supabase.from("contratos").upsert(paraRow(contrato));
    if (error) throw new Error(`Supabase (contratos): ${error.message}`);
  } else {
    await gravarLocal((dados) => {
      const indice = dados.contratos.findIndex((c) => c.id === contrato.id);
      if (indice >= 0) dados.contratos[indice] = contrato;
      else dados.contratos.push(contrato);
    });
  }

  return contrato;
}

export async function excluirContrato(id: string): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from("contratos").delete().eq("id", id);
    if (error) throw new Error(`Supabase (contratos): ${error.message}`);
    return;
  }
  await gravarLocal((dados) => {
    dados.contratos = dados.contratos.filter((c) => c.id !== id);
  });
}

function rotuloPadrao(regra: { categoria?: string | null; uf?: string | null }): string {
  const partes = [regra.categoria && regra.categoria !== "geral" ? regra.categoria : "geral"];
  if (regra.uf) partes.push(regra.uf.toUpperCase());
  return partes.join(" ");
}

function validarContrato(entrada: EntradaContrato) {
  if (!entrada.omieClienteId) throw new Error("Selecione o cliente do Omie.");
  if (!entrada.nome?.trim()) throw new Error("Informe o nome do cliente.");

  for (const regra of entrada.regras ?? []) {
    const pct = Number(regra.percentual);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
      throw new Error(
        `Percentual da faixa "${regra.rotulo || rotuloPadrao(regra)}" deve estar entre 0,01 e 100.`,
      );
    }
  }

  if (
    !entrada.regras?.length &&
    !entrada.contaCorrentePreferencial
  ) {
    throw new Error(
      "Contrato sem desconto precisa de uma conta corrente preferencial — senão ele não faz nada.",
    );
  }

  if (
    entrada.vigenciaInicio &&
    entrada.vigenciaFim &&
    entrada.vigenciaFim < entrada.vigenciaInicio
  ) {
    throw new Error("Fim da vigência não pode ser anterior ao início.");
  }
  if (entrada.tetoDesconto != null && Number(entrada.tetoDesconto) < 0) {
    throw new Error("Teto de desconto não pode ser negativo.");
  }
}

function periodosSobrepostos(
  a: { vigenciaInicio: string | null; vigenciaFim: string | null },
  b: { vigenciaInicio: string | null; vigenciaFim: string | null },
): boolean {
  const inicioA = a.vigenciaInicio ?? "0000-01-01";
  const fimA = a.vigenciaFim ?? "9999-12-31";
  const inicioB = b.vigenciaInicio ?? "0000-01-01";
  const fimB = b.vigenciaFim ?? "9999-12-31";
  return inicioA <= fimB && inicioB <= fimA;
}

// ------------------------------------------------------------------ auditoria

interface AuditoriaRow {
  id: string;
  usuario: string;
  acao: AcaoAuditoria;
  entidade: string;
  descricao: string;
  payload_enviado: unknown;
  resposta_omie: unknown;
  sucesso: boolean;
  erro: string | null;
  criado_em: string;
}

function paraEvento(row: AuditoriaRow): EventoAuditoria {
  return {
    id: row.id,
    usuario: row.usuario,
    acao: row.acao,
    entidade: row.entidade,
    descricao: row.descricao,
    payloadEnviado: row.payload_enviado,
    respostaOmie: row.resposta_omie,
    sucesso: row.sucesso,
    erro: row.erro,
    criadoEm: row.criado_em,
  };
}

export async function registrarEvento(
  evento: Omit<EventoAuditoria, "id" | "criadoEm">,
): Promise<void> {
  const completo: EventoAuditoria = {
    ...evento,
    id: randomUUID(),
    criadoEm: new Date().toISOString(),
  };

  try {
    if (supabase) {
      const { error } = await supabase.from("auditoria").insert({
        id: completo.id,
        usuario: completo.usuario,
        acao: completo.acao,
        entidade: completo.entidade,
        descricao: completo.descricao,
        payload_enviado: completo.payloadEnviado,
        resposta_omie: completo.respostaOmie,
        sucesso: completo.sucesso,
        erro: completo.erro,
        criado_em: completo.criadoEm,
      });
      if (error) throw new Error(error.message);
      return;
    }
    await gravarLocal((dados) => {
      dados.auditoria.unshift(completo);
      dados.auditoria = dados.auditoria.slice(0, 5000);
    });
  } catch (erro) {
    // Auditoria nunca deve derrubar a operação principal.
    console.error("Falha ao registrar auditoria:", erro);
  }
}

export interface FiltroAuditoria {
  acao?: AcaoAuditoria;
  usuario?: string;
  de?: string;
  ate?: string;
  limite?: number;
}

export async function listarEventos(
  filtro: FiltroAuditoria = {},
): Promise<EventoAuditoria[]> {
  const limite = filtro.limite ?? 200;

  if (supabase) {
    let consulta = supabase
      .from("auditoria")
      .select("*")
      .order("criado_em", { ascending: false })
      .limit(limite);
    if (filtro.acao) consulta = consulta.eq("acao", filtro.acao);
    if (filtro.usuario) consulta = consulta.eq("usuario", filtro.usuario);
    if (filtro.de) consulta = consulta.gte("criado_em", `${filtro.de}T00:00:00`);
    if (filtro.ate) consulta = consulta.lte("criado_em", `${filtro.ate}T23:59:59`);
    const { data, error } = await consulta;
    if (error) throw new Error(`Supabase (auditoria): ${error.message}`);
    return (data as AuditoriaRow[]).map(paraEvento);
  }

  const dados = await lerLocal();
  return dados.auditoria
    .filter((e) => (filtro.acao ? e.acao === filtro.acao : true))
    .filter((e) => (filtro.usuario ? e.usuario === filtro.usuario : true))
    .filter((e) => (filtro.de ? e.criadoEm >= `${filtro.de}T00:00:00` : true))
    .filter((e) => (filtro.ate ? e.criadoEm <= `${filtro.ate}T23:59:59` : true))
    .slice(0, limite);
}

// ------------------------------------------------------------------ aprovações

interface AprovacaoRow {
  id: string;
  titulo_id: number;
  cliente_id: number;
  cliente_nome: string;
  documento: string;
  saldo: number;
  percentual: number;
  valor_desconto: number;
  saldo_final: number;
  justificativa: string;
  solicitante: string;
  conta_corrente_id: number | null;
  data: string;
  status: StatusAprovacao;
  criado_em: string;
  decidido_em: string | null;
  decisor: string | null;
  observacao_decisao: string | null;
}

function paraAprovacao(row: AprovacaoRow): Aprovacao {
  return {
    id: row.id,
    tituloId: Number(row.titulo_id),
    clienteId: Number(row.cliente_id),
    clienteNome: row.cliente_nome,
    documento: row.documento,
    saldo: Number(row.saldo),
    percentual: Number(row.percentual),
    valorDesconto: Number(row.valor_desconto),
    saldoFinal: Number(row.saldo_final),
    justificativa: row.justificativa,
    solicitante: row.solicitante,
    contaCorrenteId: row.conta_corrente_id != null ? Number(row.conta_corrente_id) : null,
    data: row.data,
    status: row.status,
    criadoEm: row.criado_em,
    decididoEm: row.decidido_em,
    decisor: row.decisor,
    observacaoDecisao: row.observacao_decisao,
  };
}

function paraAprovacaoRow(aprovacao: Aprovacao): AprovacaoRow {
  return {
    id: aprovacao.id,
    titulo_id: aprovacao.tituloId,
    cliente_id: aprovacao.clienteId,
    cliente_nome: aprovacao.clienteNome,
    documento: aprovacao.documento,
    saldo: aprovacao.saldo,
    percentual: aprovacao.percentual,
    valor_desconto: aprovacao.valorDesconto,
    saldo_final: aprovacao.saldoFinal,
    justificativa: aprovacao.justificativa,
    solicitante: aprovacao.solicitante,
    conta_corrente_id: aprovacao.contaCorrenteId,
    data: aprovacao.data,
    status: aprovacao.status,
    criado_em: aprovacao.criadoEm,
    decidido_em: aprovacao.decididoEm,
    decisor: aprovacao.decisor,
    observacao_decisao: aprovacao.observacaoDecisao,
  };
}

export async function listarAprovacoes(status?: StatusAprovacao): Promise<Aprovacao[]> {
  if (supabase) {
    let consulta = supabase
      .from("aprovacoes")
      .select("*")
      .order("criado_em", { ascending: false })
      .limit(300);
    if (status) consulta = consulta.eq("status", status);
    const { data, error } = await consulta;
    if (error) throw new Error(`Supabase (aprovacoes): ${error.message}`);
    return (data as AprovacaoRow[]).map(paraAprovacao);
  }
  const dados = await lerLocal();
  return dados.aprovacoes
    .filter((a) => (status ? a.status === status : true))
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

export async function salvarAprovacao(aprovacao: Aprovacao): Promise<Aprovacao> {
  if (supabase) {
    const { error } = await supabase.from("aprovacoes").upsert(paraAprovacaoRow(aprovacao));
    if (error) throw new Error(`Supabase (aprovacoes): ${error.message}`);
    return aprovacao;
  }
  return gravarLocal((dados) => {
    const indice = dados.aprovacoes.findIndex((a) => a.id === aprovacao.id);
    if (indice >= 0) dados.aprovacoes[indice] = aprovacao;
    else dados.aprovacoes.unshift(aprovacao);
    return aprovacao;
  });
}

export async function buscarAprovacao(id: string): Promise<Aprovacao | null> {
  const todas = await listarAprovacoes();
  return todas.find((a) => a.id === id) ?? null;
}

export async function contarAprovacoesPendentes(): Promise<number> {
  try {
    return (await listarAprovacoes("pendente")).length;
  } catch {
    return 0;
  }
}

export function novaAprovacao(
  dados: Omit<Aprovacao, "id" | "status" | "criadoEm" | "decididoEm" | "decisor" | "observacaoDecisao">,
): Aprovacao {
  return {
    ...dados,
    id: randomUUID(),
    status: "pendente",
    criadoEm: new Date().toISOString(),
    decididoEm: null,
    decisor: null,
    observacaoDecisao: null,
  };
}

// --------------------------------------------------------------- parcelamentos

interface ParcelamentoRow {
  id: string;
  titulo_origem: number;
  cliente_nome: string;
  quantidade: number;
  valor_total: number;
  politica_original: RegistroParcelamento["politicaOriginal"];
  titulos_gerados: RegistroParcelamento["titulosGerados"];
  boletos_emitidos: number;
  usuario: string;
  criado_em: string;
}

export async function registrarParcelamento(
  registro: Omit<RegistroParcelamento, "id" | "criadoEm">,
): Promise<void> {
  const completo: RegistroParcelamento = {
    ...registro,
    id: randomUUID(),
    criadoEm: new Date().toISOString(),
  };

  try {
    if (supabase) {
      const { error } = await supabase.from("parcelamentos").insert({
        id: completo.id,
        titulo_origem: completo.tituloOrigem,
        cliente_nome: completo.clienteNome,
        quantidade: completo.quantidade,
        valor_total: completo.valorTotal,
        politica_original: completo.politicaOriginal,
        titulos_gerados: completo.titulosGerados,
        boletos_emitidos: completo.boletosEmitidos,
        usuario: completo.usuario,
        criado_em: completo.criadoEm,
      });
      if (error) throw new Error(error.message);
      return;
    }
    await gravarLocal((dados) => {
      dados.parcelamentos.unshift(completo);
      dados.parcelamentos = dados.parcelamentos.slice(0, 1000);
    });
  } catch (erro) {
    console.error("Falha ao registrar parcelamento:", erro);
  }
}

export async function listarParcelamentos(): Promise<RegistroParcelamento[]> {
  if (supabase) {
    const { data, error } = await supabase
      .from("parcelamentos")
      .select("*")
      .order("criado_em", { ascending: false })
      .limit(200);
    if (error) throw new Error(`Supabase (parcelamentos): ${error.message}`);
    return (data as ParcelamentoRow[]).map((row) => ({
      id: row.id,
      tituloOrigem: Number(row.titulo_origem),
      clienteNome: row.cliente_nome,
      quantidade: Number(row.quantidade),
      valorTotal: Number(row.valor_total),
      politicaOriginal: row.politica_original,
      titulosGerados: row.titulos_gerados ?? [],
      boletosEmitidos: Number(row.boletos_emitidos),
      usuario: row.usuario,
      criadoEm: row.criado_em,
    }));
  }
  const dados = await lerLocal();
  return dados.parcelamentos;
}

// --------------------------------------------------------------------- config

export async function lerConfig(): Promise<Config> {
  if (supabase) {
    const { data, error } = await supabase.from("config").select("chave, valor");
    if (error) throw new Error(`Supabase (config): ${error.message}`);
    const mapa = new Map(
      (data as { chave: string; valor: unknown }[]).map((r) => [r.chave, r.valor]),
    );
    return {
      pisoSaldo: Number(mapa.get("pisoSaldo") ?? CONFIG_PADRAO.pisoSaldo),
      limiteDescontoManual: Number(
        mapa.get("limiteDescontoManual") ?? CONFIG_PADRAO.limiteDescontoManual,
      ),
      contaCorrentePadrao:
        mapa.get("contaCorrentePadrao") != null
          ? Number(mapa.get("contaCorrentePadrao"))
          : null,
    };
  }
  const dados = await lerLocal();
  return { ...CONFIG_PADRAO, ...dados.config };
}

export async function salvarConfig(parcial: Partial<Config>): Promise<Config> {
  if (supabase) {
    const linhas = Object.entries(parcial).map(([chave, valor]) => ({ chave, valor }));
    if (linhas.length) {
      const { error } = await supabase.from("config").upsert(linhas, { onConflict: "chave" });
      if (error) throw new Error(`Supabase (config): ${error.message}`);
    }
    return lerConfig();
  }
  return gravarLocal((dados) => {
    dados.config = { ...CONFIG_PADRAO, ...dados.config, ...parcial };
    return dados.config as Config;
  });
}

// -------------------------------------------------------------------- usuários

interface UsuarioRow {
  usuario: string;
  nome: string;
  perfil: Perfil;
  senha_hash: string;
}

export function gerarHashSenha(senha: string): string {
  const salt = randomUUID().replace(/-/g, "");
  const hash = scryptSync(senha, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function conferirSenha(senha: string, senhaHash: string): boolean {
  const [salt, hash] = senhaHash.split(":");
  if (!salt || !hash) return false;
  const calculado = scryptSync(senha, salt, 32);
  const esperado = Buffer.from(hash, "hex");
  if (calculado.length !== esperado.length) return false;
  return timingSafeEqual(calculado, esperado);
}

export async function listarUsuarios(): Promise<Usuario[]> {
  if (supabase) {
    const { data, error } = await supabase.from("usuarios").select("*");
    if (error) throw new Error(`Supabase (usuarios): ${error.message}`);
    return (data as UsuarioRow[]).map((r) => ({
      usuario: r.usuario,
      nome: r.nome,
      perfil: r.perfil,
      senhaHash: r.senha_hash,
    }));
  }
  const dados = await lerLocal();
  return dados.usuarios;
}

export async function salvarUsuario(usuario: Usuario): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from("usuarios").upsert({
      usuario: usuario.usuario,
      nome: usuario.nome,
      perfil: usuario.perfil,
      senha_hash: usuario.senhaHash,
    });
    if (error) throw new Error(`Supabase (usuarios): ${error.message}`);
    return;
  }
  await gravarLocal((dados) => {
    const indice = dados.usuarios.findIndex((u) => u.usuario === usuario.usuario);
    if (indice >= 0) dados.usuarios[indice] = usuario;
    else dados.usuarios.push(usuario);
  });
}

/**
 * Garante que exista um usuário administrador. As credenciais iniciais vêm de
 * ADMIN_USUARIO / ADMIN_SENHA e devem ser trocadas depois do primeiro acesso.
 */
export async function garantirAdmin(): Promise<void> {
  const usuarios = await listarUsuarios();
  if (usuarios.length > 0) return;
  const login = process.env.ADMIN_USUARIO ?? "admin";
  const senha = process.env.ADMIN_SENHA ?? "trocar-senha";
  await salvarUsuario({
    usuario: login,
    nome: "Administrador",
    perfil: "gestor",
    senhaHash: gerarHashSenha(senha),
  });
}

export async function buscarUsuario(login: string): Promise<Usuario | null> {
  await garantirAdmin();
  const usuarios = await listarUsuarios();
  return usuarios.find((u) => u.usuario === login) ?? null;
}
