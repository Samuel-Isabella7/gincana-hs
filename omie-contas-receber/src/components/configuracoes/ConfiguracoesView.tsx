"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/Toasts";
import { postJson } from "@/lib/lote";
import type { Config, ContaCorrente, Perfil } from "@/lib/types";

export function ConfiguracoesView({
  config,
  contas,
  perfil,
  omieConectado,
  usandoSupabase,
  chaveMascarada,
  usuarios,
}: {
  config: Config;
  contas: ContaCorrente[];
  perfil: Perfil;
  omieConectado: boolean;
  usandoSupabase: boolean;
  chaveMascarada: { appKey: string; appSecret: string };
  usuarios: Array<{ usuario: string; nome: string; perfil: Perfil }>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [, iniciarTransicao] = useTransition();
  const gestor = perfil === "gestor";

  const [pisoSaldo, setPisoSaldo] = useState(String(config.pisoSaldo));
  const [limite, setLimite] = useState(String(config.limiteDescontoManual));
  const [contaPadrao, setContaPadrao] = useState(
    config.contaCorrentePadrao != null ? String(config.contaCorrentePadrao) : "",
  );
  const [testando, setTestando] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function salvar() {
    try {
      await postJson("/api/configuracoes", {
        pisoSaldo: Number(pisoSaldo.replace(",", ".")) || 0,
        limiteDescontoManual: Number(limite.replace(",", ".")) || 0,
        contaCorrentePadrao: contaPadrao ? Number(contaPadrao) : null,
      });
      toast("Configurações salvas.");
      iniciarTransicao(() => router.refresh());
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "erro");
    }
  }

  async function testar() {
    setTestando(true);
    setStatus(null);
    try {
      const resposta = await fetch("/api/omie/status");
      const dados = await resposta.json();
      const mensagem = dados.mensagem ?? dados.erro ?? "Sem resposta.";
      setStatus(mensagem);
      toast(mensagem, dados.ok ? "ok" : "erro");
    } finally {
      setTestando(false);
    }
  }

  return (
    <div className="grid max-w-[1080px] items-start gap-4 xl:grid-cols-2">
      <section className="cartao p-3.5">
        <h2 className="mb-3 text-[13px] font-semibold">Conexão com o Omie</h2>

        <div
          className="mb-3 flex items-start gap-2 rounded-md px-2.5 py-2"
          style={{ background: omieConectado ? "var(--pos-soft)" : "var(--warn-soft)" }}
        >
          <span
            className="ponto mt-1.5"
            style={{ background: omieConectado ? "var(--pos)" : "var(--warn)" }}
          />
          <div>
            <p
              className="text-[12.5px] font-semibold"
              style={{ color: omieConectado ? "var(--pos)" : "var(--warn)" }}
            >
              {omieConectado ? "Credenciais configuradas" : "Modo demonstração"}
            </p>
            <p className="text-[11.5px] text-suave">
              {omieConectado
                ? "As chamadas passam por /api/omie/* no servidor, com fila e retry."
                : "Defina OMIE_APP_KEY e OMIE_APP_SECRET no ambiente para operar no Omie."}
            </p>
          </div>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          <div>
            <label className="rotulo">OMIE_APP_KEY</label>
            <input className="campo mono" value={chaveMascarada.appKey} readOnly />
          </div>
          <div>
            <label className="rotulo">OMIE_APP_SECRET</label>
            <input className="campo mono" value={chaveMascarada.appSecret} readOnly />
          </div>
        </div>

        <p className="mt-2 text-[11px] text-fraco">
          As credenciais existem apenas como variáveis de ambiente do servidor — nunca são
          enviadas ao navegador nem gravadas no banco.
        </p>

        <div className="mt-3 flex items-center gap-2">
          <button className="btn" onClick={testar} disabled={testando}>
            {testando ? "Testando…" : "Testar conexão"}
          </button>
          <span className="text-[11.5px] text-suave">
            Persistência: {usandoSupabase ? "Supabase" : "arquivo local .data/store.json"}
          </span>
        </div>
        {status && <p className="mt-2 text-[12px] text-suave">{status}</p>}
      </section>

      <section className="cartao overflow-hidden">
        <h2 className="px-3.5 pt-3.5 pb-2 text-[13px] font-semibold">
          Contas correntes sincronizadas ({contas.length})
        </h2>
        <table className="tabela">
          <thead>
            <tr>
              <th>Conta</th>
              <th>Banco</th>
              <th className="text-right">nCodCC</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {contas.map((conta) => (
              <tr key={conta.id}>
                <td className="font-medium">{conta.descricao}</td>
                <td className="text-[12px]">{conta.banco ?? "—"}</td>
                <td className="num text-[11.5px]">{conta.id}</td>
                <td>
                  {config.contaCorrentePadrao === conta.id && (
                    <span className="selo bg-acento-suave text-acento">padrão</span>
                  )}
                </td>
              </tr>
            ))}
            {contas.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-[12.5px] text-fraco">
                  Nenhuma conta corrente carregada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="cartao p-3.5">
        <h2 className="mb-3 text-[13px] font-semibold">Regras financeiras</h2>
        <div className="grid gap-2.5 sm:grid-cols-3">
          <div>
            <label className="rotulo" htmlFor="conta-padrao">
              Conta corrente padrão
            </label>
            <select
              id="conta-padrao"
              className="campo"
              value={contaPadrao}
              onChange={(e) => setContaPadrao(e.target.value)}
              disabled={!gestor}
            >
              <option value="">Nenhuma</option>
              {contas.map((conta) => (
                <option key={conta.id} value={conta.id}>
                  {conta.descricao}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="rotulo" htmlFor="piso">
              Piso de saldo (R$)
            </label>
            <input
              id="piso"
              className="campo-num"
              inputMode="decimal"
              value={pisoSaldo}
              onChange={(e) => setPisoSaldo(e.target.value)}
              disabled={!gestor}
            />
          </div>
          <div>
            <label className="rotulo" htmlFor="limite">
              Desconto manual sem aprovação (R$)
            </label>
            <input
              id="limite"
              className="campo-num"
              inputMode="decimal"
              value={limite}
              onChange={(e) => setLimite(e.target.value)}
              disabled={!gestor}
            />
          </div>
        </div>

        <p className="mt-2 text-[11px] text-fraco">
          O desconto nunca deixa o título abaixo do piso e o arredondamento é sempre para baixo
          no centavo. Acima do limite, o desconto manual vai para a fila de aprovação.
        </p>

        <div className="mt-3 flex items-center gap-2">
          <button className="btn-primario" onClick={salvar} disabled={!gestor}>
            Salvar
          </button>
          {!gestor && (
            <span className="text-[11.5px] text-suave">Somente gestores podem alterar.</span>
          )}
        </div>
      </section>

      <section className="cartao overflow-hidden">
        <h2 className="px-3.5 pt-3.5 pb-2 text-[13px] font-semibold">
          Usuários e perfis ({usuarios.length})
        </h2>
        <table className="tabela">
          <thead>
            <tr>
              <th>Usuário</th>
              <th>Login</th>
              <th>Perfil</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.usuario}>
                <td>
                  <div className="flex items-center gap-2">
                    <span className="flex h-[26px] w-[26px] items-center justify-center rounded-[5px] bg-acento-suave text-[11px] font-semibold text-acento">
                      {u.nome
                        .split(" ")
                        .slice(0, 2)
                        .map((p) => p[0]?.toUpperCase())
                        .join("")}
                    </span>
                    <span className="font-medium">{u.nome}</span>
                  </div>
                </td>
                <td className="mono text-[12px]">{u.usuario}</td>
                <td>
                  <span className="selo bg-cartao-3 text-suave">
                    {u.perfil === "gestor" ? "Gestor" : "Operador financeiro"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-3.5 py-2.5 text-[11px] text-fraco">
          Usuários são criados no banco (tabela <span className="mono">usuarios</span>). O
          primeiro acesso cria o administrador a partir de ADMIN_USUARIO / ADMIN_SENHA.
        </p>
      </section>
    </div>
  );
}
