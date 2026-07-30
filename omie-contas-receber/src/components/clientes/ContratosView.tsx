"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { dataBr, formatarCnpj, moeda, percentual } from "@/lib/format";
import { postJson } from "@/lib/lote";
import type { ClienteResumo, ContaCorrente, Contrato, Perfil } from "@/lib/types";

interface Formulario {
  id?: string;
  omieClienteId: number | null;
  nome: string;
  cnpj: string;
  percentualDesconto: string;
  vigenciaInicio: string;
  vigenciaFim: string;
  tetoDesconto: string;
  contaCorrentePreferencial: string;
  ativo: boolean;
  observacoes: string;
}

const VAZIO: Formulario = {
  omieClienteId: null,
  nome: "",
  cnpj: "",
  percentualDesconto: "",
  vigenciaInicio: "",
  vigenciaFim: "",
  tetoDesconto: "",
  contaCorrentePreferencial: "",
  ativo: true,
  observacoes: "",
};

export function ContratosView({
  contratos,
  contas,
  perfil,
}: {
  contratos: Contrato[];
  contas: ContaCorrente[];
  perfil: Perfil;
}) {
  const router = useRouter();
  const [, iniciarTransicao] = useTransition();
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<Formulario>(VAZIO);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const gestor = perfil === "gestor";

  function novo() {
    setForm(VAZIO);
    setErro(null);
    setAberto(true);
  }

  function editar(contrato: Contrato) {
    setForm({
      id: contrato.id,
      omieClienteId: contrato.omieClienteId,
      nome: contrato.nome,
      cnpj: contrato.cnpj,
      percentualDesconto: String(contrato.percentualDesconto).replace(".", ","),
      vigenciaInicio: contrato.vigenciaInicio ?? "",
      vigenciaFim: contrato.vigenciaFim ?? "",
      tetoDesconto: contrato.tetoDesconto != null ? String(contrato.tetoDesconto) : "",
      contaCorrentePreferencial:
        contrato.contaCorrentePreferencial != null
          ? String(contrato.contaCorrentePreferencial)
          : "",
      ativo: contrato.ativo,
      observacoes: contrato.observacoes ?? "",
    });
    setErro(null);
    setAberto(true);
  }

  async function salvar() {
    setErro(null);
    setSalvando(true);
    try {
      await postJson("/api/contratos", {
        id: form.id,
        omieClienteId: form.omieClienteId,
        nome: form.nome,
        cnpj: form.cnpj,
        percentualDesconto: Number(form.percentualDesconto.replace(",", ".")),
        vigenciaInicio: form.vigenciaInicio || null,
        vigenciaFim: form.vigenciaFim || null,
        tetoDesconto: form.tetoDesconto ? Number(form.tetoDesconto.replace(",", ".")) : null,
        contaCorrentePreferencial: form.contaCorrentePreferencial
          ? Number(form.contaCorrentePreferencial)
          : null,
        ativo: form.ativo,
        observacoes: form.observacoes,
      });
      setAberto(false);
      iniciarTransicao(() => router.refresh());
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(contrato: Contrato) {
    if (!confirm(`Remover o contrato de ${contrato.nome}?`)) return;
    const resposta = await fetch(`/api/contratos/${contrato.id}`, { method: "DELETE" });
    if (!resposta.ok) {
      const dados = await resposta.json().catch(() => ({}));
      alert(dados.erro ?? "Falha ao remover o contrato.");
      return;
    }
    iniciarTransicao(() => router.refresh());
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Clientes especiais</h1>
          <p className="text-sm text-suave">
            Percentual de desconto de contrato aplicado pelo botão na tela de títulos.
          </p>
        </div>
        <button className="btn-primario" onClick={novo} disabled={!gestor}>
          Novo contrato
        </button>
      </header>

      {!gestor && (
        <p className="rounded-lg bg-alerta-suave px-3 py-2 text-sm text-alerta">
          Seu perfil é operador: você pode consultar os contratos, mas só um gestor pode
          criar, editar ou remover.
        </p>
      )}

      <section className="cartao overflow-hidden">
        <div className="overflow-x-auto">
          <table className="tabela">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>CNPJ</th>
                <th className="num">Desconto</th>
                <th className="num">Teto por título</th>
                <th>Vigência</th>
                <th>Conta preferencial</th>
                <th>Situação</th>
                <th>Atualizado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {contratos.map((contrato) => (
                <tr key={contrato.id}>
                  <td>
                    <div className="font-medium">{contrato.nome}</div>
                    {contrato.observacoes && (
                      <div className="text-xs text-suave">{contrato.observacoes}</div>
                    )}
                  </td>
                  <td>{formatarCnpj(contrato.cnpj)}</td>
                  <td className="num font-medium text-acento">
                    {percentual(contrato.percentualDesconto)}
                  </td>
                  <td className="num">
                    {contrato.tetoDesconto != null ? moeda(contrato.tetoDesconto) : "—"}
                  </td>
                  <td className="whitespace-nowrap">
                    {contrato.vigenciaInicio || contrato.vigenciaFim
                      ? `${dataBr(contrato.vigenciaInicio)} → ${dataBr(contrato.vigenciaFim)}`
                      : "sem prazo"}
                  </td>
                  <td>
                    {contas.find((c) => c.id === contrato.contaCorrentePreferencial)
                      ?.descricao ?? "—"}
                  </td>
                  <td>
                    <span
                      className={`selo ${
                        contrato.ativo
                          ? "bg-positivo-suave text-positivo"
                          : "bg-cartao-alt text-suave"
                      }`}
                    >
                      {contrato.ativo ? "ativo" : "inativo"}
                    </span>
                  </td>
                  <td className="text-xs text-suave">{dataBr(contrato.atualizadoEm.slice(0, 10))}</td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <button
                        className="btn-mini"
                        onClick={() => editar(contrato)}
                        disabled={!gestor}
                      >
                        Editar
                      </button>
                      <button
                        className="btn-mini"
                        onClick={() => excluir(contrato)}
                        disabled={!gestor}
                      >
                        Remover
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {contratos.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-sm text-suave">
                    Nenhum cliente especial cadastrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {aberto && (
        <Modal
          titulo={form.id ? "Editar contrato" : "Novo contrato"}
          descricao="O percentual informado é aplicado sobre o saldo do título no momento do lançamento."
          onFechar={() => setAberto(false)}
          rodape={
            <>
              <button className="btn" onClick={() => setAberto(false)} disabled={salvando}>
                Cancelar
              </button>
              <button className="btn-primario" onClick={salvar} disabled={salvando}>
                {salvando ? "Salvando…" : "Salvar contrato"}
              </button>
            </>
          }
        >
          <BuscaCliente
            nome={form.nome}
            onSelecionar={(cliente) =>
              setForm((atual) => ({
                ...atual,
                omieClienteId: cliente.id,
                nome: cliente.nome,
                cnpj: cliente.cnpj,
              }))
            }
          />

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div>
              <label className="rotulo" htmlFor="pct">
                Percentual de desconto (%)
              </label>
              <input
                id="pct"
                className="campo-num"
                inputMode="decimal"
                value={form.percentualDesconto}
                onChange={(e) =>
                  setForm((a) => ({ ...a, percentualDesconto: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="rotulo" htmlFor="teto">
                Teto de desconto por título (R$, opcional)
              </label>
              <input
                id="teto"
                className="campo-num"
                inputMode="decimal"
                value={form.tetoDesconto}
                onChange={(e) => setForm((a) => ({ ...a, tetoDesconto: e.target.value }))}
              />
            </div>
            <div>
              <label className="rotulo" htmlFor="vig-inicio">
                Início da vigência
              </label>
              <input
                id="vig-inicio"
                type="date"
                className="campo"
                value={form.vigenciaInicio}
                onChange={(e) => setForm((a) => ({ ...a, vigenciaInicio: e.target.value }))}
              />
            </div>
            <div>
              <label className="rotulo" htmlFor="vig-fim">
                Fim da vigência
              </label>
              <input
                id="vig-fim"
                type="date"
                className="campo"
                value={form.vigenciaFim}
                onChange={(e) => setForm((a) => ({ ...a, vigenciaFim: e.target.value }))}
              />
            </div>
            <div>
              <label className="rotulo" htmlFor="conta-pref">
                Conta corrente preferencial
              </label>
              <select
                id="conta-pref"
                className="campo"
                value={form.contaCorrentePreferencial}
                onChange={(e) =>
                  setForm((a) => ({ ...a, contaCorrentePreferencial: e.target.value }))
                }
              >
                <option value="">Nenhuma</option>
                {contas.map((conta) => (
                  <option key={conta.id} value={conta.id}>
                    {conta.descricao}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(e) => setForm((a) => ({ ...a, ativo: e.target.checked }))}
                />
                Contrato ativo
              </label>
            </div>
          </div>

          <div className="mt-3">
            <label className="rotulo" htmlFor="obs">
              Observações
            </label>
            <input
              id="obs"
              className="campo"
              value={form.observacoes}
              onChange={(e) => setForm((a) => ({ ...a, observacoes: e.target.value }))}
            />
          </div>

          {erro && (
            <p className="mt-3 rounded-lg bg-negativo-suave px-3 py-2 text-sm text-negativo">
              {erro}
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}

function BuscaCliente({
  nome,
  onSelecionar,
}: {
  nome: string;
  onSelecionar: (cliente: ClienteResumo) => void;
}) {
  const [busca, setBusca] = useState(nome);
  const [opcoes, setOpcoes] = useState<ClienteResumo[]>([]);
  const [carregando, setCarregando] = useState(false);

  const buscando = busca.trim().length >= 3 && busca !== nome;
  // Opções ficam derivadas do termo atual: assim não é preciso limpar estado no efeito.
  const visiveis = buscando ? opcoes : [];

  useEffect(() => {
    if (!buscando) return;
    const tempo = setTimeout(async () => {
      setCarregando(true);
      try {
        const resposta = await fetch(`/api/clientes?busca=${encodeURIComponent(busca)}`);
        const dados = await resposta.json();
        setOpcoes(dados.clientes ?? []);
      } finally {
        setCarregando(false);
      }
    }, 350);
    return () => clearTimeout(tempo);
  }, [busca, buscando]);

  return (
    <div>
      <label className="rotulo" htmlFor="busca-cliente">
        Cliente no Omie
      </label>
      <input
        id="busca-cliente"
        className="campo"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Digite pelo menos 3 letras do nome ou o CNPJ"
      />
      {carregando && <p className="mt-1 text-xs text-suave">Buscando no Omie…</p>}
      {visiveis.length > 0 && (
        <ul className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-borda">
          {visiveis.map((cliente) => (
            <li key={cliente.id}>
              <button
                type="button"
                className="flex w-full items-baseline justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-cartao-alt"
                onClick={() => {
                  onSelecionar(cliente);
                  setBusca(cliente.nome);
                  setOpcoes([]);
                }}
              >
                <span>{cliente.nome}</span>
                <span className="text-xs text-suave">{formatarCnpj(cliente.cnpj)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {nome && <p className="mt-1 text-xs text-suave">Selecionado: {nome}</p>}
    </div>
  );
}
