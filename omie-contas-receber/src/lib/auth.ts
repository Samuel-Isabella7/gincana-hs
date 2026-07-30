import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Perfil, Usuario } from "./types";

const COOKIE = "cr_sessao";
const DURACAO_MS = 8 * 60 * 60 * 1000;
const SEGREDO =
  process.env.SESSION_SECRET ?? "desenvolvimento-trocar-SESSION_SECRET";

export interface Sessao {
  usuario: string;
  nome: string;
  perfil: Perfil;
  expira: number;
}

function assinar(dados: string): string {
  return createHmac("sha256", SEGREDO).update(dados).digest("base64url");
}

function serializar(sessao: Sessao): string {
  const dados = Buffer.from(JSON.stringify(sessao)).toString("base64url");
  return `${dados}.${assinar(dados)}`;
}

function desserializar(valor: string): Sessao | null {
  const [dados, assinatura] = valor.split(".");
  if (!dados || !assinatura) return null;

  const esperada = Buffer.from(assinar(dados));
  const recebida = Buffer.from(assinatura);
  if (esperada.length !== recebida.length || !timingSafeEqual(esperada, recebida)) {
    return null;
  }

  try {
    const sessao = JSON.parse(Buffer.from(dados, "base64url").toString()) as Sessao;
    if (sessao.expira < Date.now()) return null;
    return sessao;
  } catch {
    return null;
  }
}

export async function criarSessao(usuario: Usuario): Promise<void> {
  const sessao: Sessao = {
    usuario: usuario.usuario,
    nome: usuario.nome,
    perfil: usuario.perfil,
    expira: Date.now() + DURACAO_MS,
  };
  const jar = await cookies();
  jar.set(COOKIE, serializar(sessao), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DURACAO_MS / 1000,
  });
}

export async function encerrarSessao(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function sessaoAtual(): Promise<Sessao | null> {
  const jar = await cookies();
  const valor = jar.get(COOKIE)?.value;
  return valor ? desserializar(valor) : null;
}

/** Para páginas: redireciona ao login quando não há sessão válida. */
export async function exigirSessao(): Promise<Sessao> {
  const sessao = await sessaoAtual();
  if (!sessao) redirect("/login");
  return sessao;
}

export class NaoAutorizado extends Error {
  constructor(mensagem = "Sessão expirada. Faça login novamente.") {
    super(mensagem);
    this.name = "NaoAutorizado";
  }
}

/** Para rotas de API: lança NaoAutorizado em vez de redirecionar. */
export async function exigirSessaoApi(): Promise<Sessao> {
  const sessao = await sessaoAtual();
  if (!sessao) throw new NaoAutorizado();
  return sessao;
}

export function exigirGestor(sessao: Sessao): void {
  if (sessao.perfil !== "gestor") {
    throw new NaoAutorizado("Esta operação exige perfil gestor.");
  }
}

export const NOME_COOKIE_SESSAO = COOKIE;
