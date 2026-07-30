"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function Formulario() {
  const router = useRouter();
  const parametros = useSearchParams();
  const proximo = parametros.get("proximo") || "/titulos";

  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const resposta = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, senha }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro ?? "Falha no login.");
      router.replace(proximo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={entrar} className="w-full max-w-[340px]">
      <div className="mb-10 flex items-baseline gap-2">
        <span className="text-[19px] font-bold tracking-[0.13em]">KALENA</span>
        <span className="text-[11px] font-semibold tracking-[0.13em] text-fraco">FOODS</span>
      </div>

      <h1 className="text-[22px] font-semibold">Contas a Receber</h1>
      <p className="mt-1 mb-6 text-[13px] text-suave">Acesse com sua conta corporativa.</p>

      <label className="rotulo" htmlFor="usuario">
        Usuário
      </label>
      <input
        id="usuario"
        className="campo campo-alto mb-3.5"
        value={usuario}
        onChange={(e) => setUsuario(e.target.value)}
        autoComplete="username"
        autoFocus
      />

      <label className="rotulo" htmlFor="senha">
        Senha
      </label>
      <input
        id="senha"
        type="password"
        className="campo campo-alto mb-4"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        autoComplete="current-password"
      />

      {erro && <p className="aviso aviso-erro mb-3.5">{erro}</p>}

      <button className="btn-primario h-10 w-full" disabled={enviando}>
        {enviando ? "Entrando…" : "Entrar"}
      </button>

      <p className="mono mt-3 text-[11px] text-fraco">
        sessão em cookie assinado · 8 horas
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <div className="flex items-center justify-center p-12">
        <Suspense>
          <Formulario />
        </Suspense>
      </div>

      <div className="hidden flex-col justify-end border-l border-borda bg-cartao-alt p-12 md:flex">
        <p className="mono mb-3 text-[11px] tracking-[0.06em] text-fraco uppercase">
          Integração ERP Omie · server-side
        </p>
        <p className="max-w-[380px] text-[15px] leading-relaxed text-suave">
          Desconto de contrato em lote, boleto, parcelamento e troca de conta bancária — com
          pré-visualização antes de gravar e trilha de auditoria de tudo que sai para o Omie.
        </p>
        <div className="my-6 border-t border-borda" />
        <p className="flex items-center gap-2 text-[12px] text-fraco">
          <span className="ponto" style={{ background: "var(--warn)" }} />
          Sem credenciais do Omie, o sistema abre em modo demonstração.
        </p>
      </div>
    </main>
  );
}
