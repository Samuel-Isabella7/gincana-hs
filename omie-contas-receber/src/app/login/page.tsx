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
    <form onSubmit={entrar} className="cartao w-full max-w-sm p-6">
      <div className="mb-6">
        <p className="text-xs font-semibold tracking-widest text-acento uppercase">
          Financeiro
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Contas a Receber</h1>
        <p className="mt-1 text-sm text-suave">Integrado ao ERP Omie</p>
      </div>

      <label className="rotulo" htmlFor="usuario">
        Usuário
      </label>
      <input
        id="usuario"
        className="campo mb-4"
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
        className="campo mb-4"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        autoComplete="current-password"
      />

      {erro && (
        <p className="mb-4 rounded-lg bg-negativo-suave px-3 py-2 text-sm text-negativo">
          {erro}
        </p>
      )}

      <button className="btn-primario w-full" disabled={enviando}>
        {enviando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Suspense>
        <Formulario />
      </Suspense>
    </main>
  );
}
