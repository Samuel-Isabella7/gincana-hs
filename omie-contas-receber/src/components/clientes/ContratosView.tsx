"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toasts";
import { dataBr, dataHoraBr, formatarCnpj, hoje, moeda, percentual } from "@/lib/format";
import { postJson } from "@/lib/lote";
import type {
  ClienteResumo,
  ContaCorrente,
  Contrato,
  EventoAuditoria,
  Perfil,
} from "@/lib/types";

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

function situacao(contrato: Contrato): { rotulo: string; classe: string } {
  if (!contrato.ativo) return { rotulo: "Inativo", classe: "bg-cartao-3 text-fraco" };
  if (contrato.vigenciaFim && contrato.vigenciaFim < hoje()) {
    return { rotulo: "Expirado", classe: "bg-alerta-suave text-alerta" };
  }
  return { rotulo: "Ativo", classe: "bg-positivo-suave text-positivo" };
}

export function ContratosView({
  contratos,
  contas,
  perfil,
  historico,
}: {
  contratos: Contrato[];
  contas: ContaCorrente[];
  perfil: Perfil;
  historico: EventoAuditoria[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [, iniciarTransicao] = useTransition();
  const [busca, setBusca] = useState("");
  const [somenteVigentes, setSomenteVigentes] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<Formulario>(VAZIO);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const gestor = perfil === "gestor";

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return contratos.filter((contrato) => {
      if (termo) {
        const alvo = `${contrato.nome} ${contrato.cnpj}`.toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      if (somenteVigentes && situacao(contrato).rotulo !== "Ativo") return false;
      return true;
    });
  }, [contratos, busca, somenteVigentes]);

  const historicoPor = useMemo(() => {
    const mapa = new Map<string, EventoAuditoria[]>();
    for (const evento of historico) {
      const id = evento.entidade.startsWith("contrato:")
        ? evento.entidade.slice("contrato:".length)
        : null;
      if (!id) continue;
      const lista = mapa.get(id) ?? [];
      lista.push(evento);
      mapa.set(id, lista);
    }
    return mapa;
  }, [historico]);

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
      toast(form.id ? "Contrato atualizado." : "Contrato criado.");
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
      toast(dados.erro ?? "Falha ao remover o contrato.", "erro");
      return;
    }
    toast("Contrato removido.");
    iniciarTransicao(() => router.refresh());
  }

  return (
    <>
      <section className="cartao flex flex-wrap items-end gap-2 bg-cartao-alt p-2.5">
        <div className="w-[268px]">
          <label className="rotulo" htmlFor="busca-contrato">
            Cliente ou CNPJ
          </label>
          <input
            id="busca-contrato"
            className="campo"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar…"
          />
        </div>
        <label className="flex h-[30px] items-center gap-1.5 text-[12.5px]">
          <input
            type="checkbox"
            checked={somenteVigentes}
            onChange={(e) => setSomenteVigentes(e.target.checked)}
          />
          Somente vigentes
        </label>
        <button className="btn-primario ml-auto" onClick={novo} disabled={!gestor}>
          + Novo contrato
        </button>
      </section>

      {!gestor && (
        <p className="aviso aviso-alerta">
          Seu perfil é operador: você consulta os contratos, mas só um gestor cria, edita ou
          remove.
        </p>
      )}

      <section className="cartao cartao-sombra overflow-hidden">
        <div className="overflow-x-auto">
          <table className="tabela">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>CNPJ</th>
                <th className="text-right">% contrato</th>
                <th className="text-right">Teto/título</th>
                <th>Vigência</th>
                <th>Conta preferencial</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtrados.map((contrato) => {
                const estado = situacao(contrato);
                const eventos = historicoPor.get(contrato.id) ?? [];
                const aberta = expandido === contrato.id;
                return (
                  <>
                    <tr key={contrato.id}>
                      <td>
                        <div className="font-medium">{contrato.nome}</div>
                        {contrato.observacoes && (
                          <div className="text-[11px] text-fraco">{contrato.observacoes}</div>
                        )}
                      </td>
                      <td className="mono text-[12px]">{formatarCnpj(contrato.cnpj)}</td>
                      <td className="num font-semibold text-positivo">
                        −{percentual(contrato.percentualDesconto)}
                      </td>
                      <td className="num">
                        {contrato.tetoDesconto != null ? moeda(contrato.tetoDesconto) : "—"}
                      </td>
                      <td className="mono text-[11.5px]">
                        {contrato.vigenciaInicio || contrato.vigenciaFim
                          ? `${dataBr(contrato.vigenciaInicio)} – ${dataBr(contrato.vigenciaFim)}`
                          : "sem prazo"}
                      </td>
                      <td className="text-[12px]">
                        {contas.find((c) => c.id === contrato.contaCorrentePreferencial)
                          ?.descricao ?? "—"}
                      </td>
                      <td>
                        <span className={`selo ${estado.classe}`}>{estado.rotulo}</span>
                      </td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <button
                            className="btn-mini"
                            onClick={() => setExpandido(aberta ? null : contrato.id)}
                          >
                            {aberta ? "Fechar" : "Histórico"}
                          </button>
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

                    {aberta && (
                      <tr key={`${contrato.id}-historico`}>
                        <td colSpan={8} className="bg-cartao-alt">
                          <p className="eyebrow mb-2">
                            Histórico de alterações do percentual
                          </p>
                          {eventos.length === 0 ? (
                            <p className="text-[12px] text-fraco">
                              Nenhuma alteração registrada além da criação.
                            </p>
                          ) : (
                            <ul className="flex flex-col gap-1">
                              {eventos.map((evento) => (
                                <li
                                  key={evento.id}
                                  className="grid gap-2 text-[12px] md:grid-cols-[130px_1fr_200px]"
                                >
                                  <span className="mono text-fraco">
                                    {dataHoraBr(evento.criadoEm)}
                                  </span>
                                  <span>{evento.descricao}</span>
                                  <span className="text-right text-suave">
                                    {evento.usuario}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}

              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <div className="mx-auto max-w-sm rounded-lg border border-dashed border-borda p-6">
                      <p className="text-[13.5px] font-semibold">
                        Nenhum cliente especial cadastrado
                      </p>
                      <p className="mt-1 text-[12.5px] text-fraco">
                        Cadastre o percentual de contrato para o botão de desconto usar.
                      </p>
                    </div>
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
          descricao="O percentual é aplicado sobre o saldo do título no momento do lançamento."
          largura="max-w-[680px]"
          onFechar={() => setAberto(false)}
          rodape={
            <>
              <button
                className="btn btn-modal ml-auto"
                onClick={() => setAberto(false)}
                disabled={salvando}
              >
                Cancelar
              </button>
              <button className="btn-primario btn-modal" onClick={salvar} disabled={salvando}>
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

          <div className="mt-3.5 grid gap-3 md:grid-cols-2">
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
                Teto por título (R$, opcional)
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
              <label className="flex h-[30px] items-center gap-2 text-[12.5px]">
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

          {erro && <p className="aviso aviso-erro mt-3">{erro}</p>}
        </Modal>
      )}
    </>
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
      {carregando && <p className="mt-1 text-[11px] text-fraco">Buscando no Omie…</p>}
      {visiveis.length > 0 && (
        <ul className="mt-1.5 max-h-48 overflow-y-auto rounded-md border border-borda">
          {visiveis.map((cliente) => (
            <li key={cliente.id}>
              <button
                type="button"
                className="flex w-full cursor-pointer items-baseline justify-between gap-2 px-2.5 py-1.5 text-left text-[12.5px] hover:bg-cartao-3"
                onClick={() => {
                  onSelecionar(cliente);
                  setBusca(cliente.nome);
                  setOpcoes([]);
                }}
              >
                <span>{cliente.nome}</span>
                <span className="mono text-[11px] text-fraco">
                  {formatarCnpj(cliente.cnpj)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {nome && <p className="mono mt-1 text-[11px] text-fraco">selecionado: {nome}</p>}
    </div>
  );
}
