"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { postJson } from "@/lib/lote";
import type { Config, ContaCorrente, Perfil } from "@/lib/types";

export function ConfiguracoesView({
  config,
  contas,
  perfil,
  omieConectado,
  usandoSupabase,
}: {
  config: Config;
  contas: ContaCorrente[];
  perfil: Perfil;
  omieConectado: boolean;
  usandoSupabase: boolean;
}) {
  const router = useRouter();
  const [, iniciarTransicao] = useTransition();
  const gestor = perfil === "gestor";

  const [pisoSaldo, setPisoSaldo] = useState(String(config.pisoSaldo));
  const [limite, setLimite] = useState(String(config.limiteDescontoManual));
  const [contaPadrao, setContaPadrao] = useState(
    config.contaCorrentePadrao != null ? String(config.contaCorrentePadrao) : "",
  );
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function salvar() {
    setErro(null);
    setMensagem(null);
    try {
      await postJson("/api/configuracoes", {
        pisoSaldo: Number(pisoSaldo.replace(",", ".")) || 0,
        limiteDescontoManual: Number(limite.replace(",", ".")) || 0,
        contaCorrentePadrao: contaPadrao ? Number(contaPadrao) : null,
      });
      setMensagem("Configurações salvas.");
      iniciarTransicao(() => router.refresh());
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }

  async function testar() {
    setStatus("Testando…");
    const resposta = await fetch("/api/omie/status");
    const dados = await resposta.json();
    setStatus(dados.mensagem ?? dados.erro ?? "Sem resposta.");
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-sm text-suave">
          Conexão com o Omie, contas correntes e limites das operações de desconto.
        </p>
      </header>

      <section className="cartao p-4">
        <h2 className="titulo-secao mb-3">Conexão com o Omie</h2>
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`selo ${
              omieConectado
                ? "bg-positivo-suave text-positivo"
                : "bg-alerta-suave text-alerta"
            }`}
          >
            {omieConectado ? "credenciais configuradas" : "modo demonstração"}
          </span>
          <button className="btn" onClick={testar}>
            Testar conexão
          </button>
          <span className="text-sm text-suave">
            Persistência: {usandoSupabase ? "Supabase" : "arquivo local .data/store.json"}
          </span>
        </div>
        {status && <p className="mt-3 text-sm text-suave">{status}</p>}
      </section>

      <section className="cartao p-4">
        <h2 className="titulo-secao mb-3">Regras de desconto</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="rotulo" htmlFor="piso">
              Saldo mínimo após o desconto (R$)
            </label>
            <input
              id="piso"
              className="campo-num"
              inputMode="decimal"
              value={pisoSaldo}
              onChange={(e) => setPisoSaldo(e.target.value)}
              disabled={!gestor}
            />
            <p className="mt-1 text-xs text-suave">
              O desconto é reduzido para nunca deixar o título abaixo deste saldo.
            </p>
          </div>
          <div>
            <label className="rotulo" htmlFor="limite">
              Limite de desconto manual sem gestor (R$)
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
            <p className="mt-1 text-xs text-suave">
              Usada quando o título não tem conta corrente definida.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button className="btn-primario" onClick={salvar} disabled={!gestor}>
            Salvar
          </button>
          {mensagem && <span className="text-sm text-positivo">{mensagem}</span>}
          {erro && <span className="text-sm text-negativo">{erro}</span>}
          {!gestor && (
            <span className="text-sm text-suave">Somente gestores podem alterar.</span>
          )}
        </div>
      </section>

      <section className="cartao overflow-hidden">
        <h2 className="titulo-secao px-4 pt-4 pb-2">
          Contas correntes sincronizadas ({contas.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="tabela">
            <thead>
              <tr>
                <th>Código Omie</th>
                <th>Descrição</th>
                <th>Banco</th>
                <th>Tipo</th>
              </tr>
            </thead>
            <tbody>
              {contas.map((conta) => (
                <tr key={conta.id}>
                  <td className="font-mono text-xs">{conta.id}</td>
                  <td className="font-medium">{conta.descricao}</td>
                  <td>{conta.banco ?? "—"}</td>
                  <td className="text-xs text-suave">{conta.tipo ?? "—"}</td>
                </tr>
              ))}
              {contas.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-sm text-suave">
                    Nenhuma conta corrente carregada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
