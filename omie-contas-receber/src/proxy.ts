import { NextResponse, type NextRequest } from "next/server";

/**
 * Verificação otimista: só confere a presença do cookie de sessão para evitar
 * renderizar páginas internas sem login. A validação da assinatura acontece no
 * servidor, em cada página e rota de API.
 */
export function proxy(request: NextRequest) {
  const temSessao = request.cookies.has("cr_sessao");
  const { pathname } = request.nextUrl;

  if (!temSessao) {
    const destino = new URL("/login", request.url);
    destino.searchParams.set("proximo", pathname);
    return NextResponse.redirect(destino);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/titulos/:path*",
    "/clientes/:path*",
    "/auditoria/:path*",
    "/configuracoes/:path*",
  ],
};
