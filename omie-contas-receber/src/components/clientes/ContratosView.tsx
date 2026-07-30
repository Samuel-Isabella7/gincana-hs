"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toasts";
import { dataBr, dataHoraBr, formatarCnpj, hoje, moeda, percentual } from "@/lib/format";
import { postJson } from "@/lib/lote";
import type {
  CategoriaProduto,
  ClienteResumo,
  ContaCorrente,
  Contrato,
  EventoAuditoria,
  Perfil,
} from "@/lib/types";

interface RegraForm {
  id: string;
  rotulo: string;
  categoria: CategoriaProduto;
  uf: string;
  percentual: string;
  padrao: boolean;
}

interface Formulario {
  id?: string;
  omieClienteId: number | null;
  nome: string;
  cnpj: string;
  grupo: string;
  regras: RegraForm[];
  vigenciaInicio: string;
  vigenciaFim: string;
  tetoDesconto: string;
  contaCorrentePreferencial: string;
  aplicarContaSempre: boolean;
  ativo: boolean;
  observacoes: string;
}

const VAZIO: Formulario = {
  omieClienteId: null,
  nome: "",
  cnpj: "",
  grupo: "",
  regras: [
    { id: "nova-1", rotulo: "geral", categoria: "geral", uf: "", percentual: "", padrao: true },
  ],
  vigenciaInicio: "",
  vigenciaFim: "",
  tetoDesconto: "",
  contaCorrentePreferencial: "",
  aplicarContaSempre: true,
  ativo: true,
  observacoes: "",
};

interface LinhaImportacao {
  nome: string;
  grupo: string | null;
  banco: string;
  regras: string;
  situacao: string;
  detalhe: string;
  clienteNome: string | null;
  contaCorrenteNome: string | null;
}

const SITUACOES: Record<string, { rotulo: string; classe: string }> = {
  novo: { rotulo: "criar", classe: "bg-positivo-suave text-positivo" },
  atualiza: { rotulo: "atualizar", classe: "bg-acento-suave text-acento" },
  "sem-alteracao": { rotulo: "já igual", classe: "bg-cartao-3 text-fraco" },
  "cliente-ambiguo": { rotulo: "cliente ambíguo", classe: "bg-alerta-suave text-alerta" },
  "cliente-nao-encontrado": { rotulo: "sem cliente", classe: "bg-negativo-suave text-negativo" },
  "conta-nao-encontrada": { rotulo: "sem conta", classe: "bg-negativo-suave text-negativo" },
};

function situacaoContrato(contrato: Contrato): { rotulo: string; classe: string } {
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
  const [importacao, setImportacao] = useState<LinhaImportacao[] | null>(null);
  const [importando, setImportando] = useState(false);
  const gestor = perfil === "gestor";

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return contratos.filter((contrato) => {
      if (termo) {
        const alvo = `${contrato.nome} ${contrato.cnpj} ${contrato.grupo ?? ""}`.toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      if (somenteVigentes && situacaoContrato(contrato).rotulo !== "Ativo") return false;
      return true;
    });
  }, [contratos, busca, somenteVigentes]);

  const historicoPor = useMemo(() => {
    const mapa = new Map<string, EventoAuditoria[]>();
    for (const evento of historico) {
      if (!evento.entidade.startsWith("contrato:")) continue;
      const id = evento.entidade.slice("contrato:".length);
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
      grupo: contrato.grupo ?? "",
      regras: contrato.regras.map((regra) => ({
        id: regra.id,
        rotulo: regra.rotulo,
        categoria: regra.categoria,
        uf: regra.uf ?? "",
        percentual: String(regra.percentual).replace(".", ","),
        padrao: regra.padrao,
      })),
      vigenciaInicio: contrato.vigenciaInicio ?? "",
      vigenciaFim: contrato.vigenciaFim ?? "",
      tetoDesconto: contrato.tetoDesconto != null ? String(contrato.tetoDesconto) : "",
      contaCorrentePreferencial:
        contrato.contaCorrentePreferencial != null
          ? String(contrato.contaCorrentePreferencial)
          : "",
      aplicarContaSempre: contrato.aplicarContaSempre,
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
        grupo: form.grupo,
        regras: form.regras
          .filter((regra) => regra.percentual.trim() !== "")
          .map((regra) => ({
            id: regra.id.startsWith("nova-") ? undefined : regra.id,
            rotulo: regra.rotulo,
            categoria: regra.categoria,
            uf: regra.uf || null,
            percentual: Number(regra.percentual.replace(",", ".")),
            padrao: regra.padrao,
          })),
        vigenciaInicio: form.vigenciaInicio || null,
        vigenciaFim: form.vigenciaFim || null,
        tetoDesconto: form.tetoDesconto ? Number(form.tetoDesconto.replace(",", ".")) : null,
        contaCorrentePreferencial: form.contaCorrentePreferencial
          ? Number(form.contaCorrentePreferencial)
          : null,
        aplicarContaSempre: form.aplicarContaSempre,
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

  async function planejarImportacao() {
    setImportando(true);
    try {
      const resposta = await fetch("/api/contratos/importar");
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro ?? "Falha ao ler a lista.");
      setImportacao(dados.linhas);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "erro");
    } finally {
      setImportando(false);
    }
  }

  async function aplicarImportacao() {
    setImportando(true);
    try {
      const dados = await postJson<{
        criados: number;
        atualizados: number;
        ignorados: LinhaImportacao[];
      }>("/api/contratos/importar", {});
      toast(
        `${dados.criados} criado(s), ${dados.atualizados} atualizado(s), ${dados.ignorados.length} pendente(s).`,
      );
      setImportacao(null);
      iniciarTransicao(() => router.refresh());
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "erro");
    } finally {
      setImportando(false);
    }
  }

  const aplicaveis =
    importacao?.filter((l) => l.situacao === "novo" || l.situacao === "atualiza").length ?? 0;

  return (
    <>
      <section className="cartao flex flex-wrap items-end gap-2 bg-cartao-alt p-2.5">
        <div className="w-[268px]">
          <label className="rotulo" htmlFor="busca-contrato">
            Cliente, CNPJ ou grupo
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
        <button
          className="btn ml-auto"
          onClick={planejarImportacao}
          disabled={importando || !gestor}
          title="Compara a lista de clientes especiais do repositório com o que já está cadastrado"
        >
          {importando ? "Lendo lista…" : "Importar lista de contratos"}
        </button>
        <button className="btn-primario" onClick={novo} disabled={!gestor}>
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
                <th>Faixas de desconto</th>
                <th className="text-right">Teto/título</th>
                <th>Vigência</th>
                <th>Banco do contrato</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtrados.map((contrato) => {
                const estado = situacaoContrato(contrato);
                const eventos = historicoPor.get(contrato.id) ?? [];
                const aberta = expandido === contrato.id;
                const conta = contas.find((c) => c.id === contrato.contaCorrentePreferencial);
                return (
                  <>
                    <tr key={contrato.id}>
                      <td>
                        <div className="font-medium">{contrato.nome}</div>
                        {contrato.grupo && (
                          <div className="text-[11px] text-fraco">grupo: {contrato.grupo}</div>
                        )}
                        {contrato.observacoes && (
                          <div className="text-[11px] text-fraco">{contrato.observacoes}</div>
                        )}
                      </td>
                      <td className="mono text-[12px]">{formatarCnpj(contrato.cnpj)}</td>
                      <td>
                        {contrato.regras.length === 0 ? (
                          <span className="selo bg-cartao-3 text-fraco">sem desconto</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {contrato.regras.map((regra) => (
                              <span
                                key={regra.id}
                                className="selo bg-positivo-suave text-positivo"
                                title={regra.uf ? `praça ${regra.uf}` : undefined}
                              >
                                {regra.rotulo} −{percentual(regra.percentual)}
                                {regra.padrao && contrato.regras.length > 1 ? " ★" : ""}
                              </span>
                            ))}
                          </div>
                        )}
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
                        {conta?.descricao ?? "—"}
                        {conta && contrato.aplicarContaSempre && (
                          <span className="block text-[10.5px] text-acento">sempre aplicar</span>
                        )}
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
                          <p className="eyebrow mb-2">Histórico de alterações</p>
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
                                  <span className="text-right text-suave">{evento.usuario}</span>
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
                    <div className="mx-auto max-w-md rounded-lg border border-dashed border-borda p-6">
                      <p className="text-[13.5px] font-semibold">
                        Nenhum cliente especial cadastrado
                      </p>
                      <p className="mt-1 text-[12.5px] text-fraco">
                        Use “Importar lista de contratos” para cadastrar a carteira de uma vez.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {importacao && (
        <Modal
          titulo="Importar lista de contratos"
          descricao="Comparação entre a lista do repositório e o que já está cadastrado. Nada é gravado até você aplicar."
          onFechar={() => setImportacao(null)}
          rodape={
            <>
              <span className="mr-auto text-[12px] text-suave">
                {aplicaveis} contrato(s) para gravar ·{" "}
                {importacao.length - aplicaveis} sem ação
              </span>
              <button className="btn btn-modal" onClick={() => setImportacao(null)}>
                Fechar
              </button>
              <button
                className="btn-primario btn-modal"
                onClick={aplicarImportacao}
                disabled={importando || aplicaveis === 0}
              >
                {importando ? "Gravando…" : `Aplicar ${aplicaveis} contrato(s)`}
              </button>
            </>
          }
        >
          <div className="cartao overflow-hidden">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Lista</th>
                  <th>Cliente no Omie</th>
                  <th>Faixas</th>
                  <th>Banco</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {importacao.map((linha) => {
                  const situacao = SITUACOES[linha.situacao] ?? {
                    rotulo: linha.situacao,
                    classe: "bg-cartao-3 text-fraco",
                  };
                  return (
                    <tr key={`${linha.nome}-${linha.situacao}`}>
                      <td>
                        <div className="font-medium">{linha.nome}</div>
                        {linha.grupo && (
                          <div className="text-[11px] text-fraco">{linha.grupo}</div>
                        )}
                      </td>
                      <td className="text-[12px]">
                        {linha.clienteNome ?? <span className="text-negativo">não achou</span>}
                      </td>
                      <td className="text-[11.5px]">{linha.regras}</td>
                      <td className="text-[12px]">
                        {linha.contaCorrenteNome ?? (
                          <span className="text-negativo">{linha.banco}</span>
                        )}
                      </td>
                      <td>
                        <span className={`selo ${situacao.classe}`}>{situacao.rotulo}</span>
                        <div className="text-[11px] text-fraco">{linha.detalhe}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {aberto && (
        <Modal
          titulo={form.id ? "Editar contrato" : "Novo contrato"}
          descricao="Cada faixa vale para uma categoria (secos/congelados) e/ou praça. Sem faixa nenhuma, o contrato só fixa o banco de cobrança."
          largura="max-w-[820px]"
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
          <div className="grid gap-3 md:grid-cols-2">
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
            <div>
              <label className="rotulo" htmlFor="grupo">
                Grupo / rede (opcional)
              </label>
              <input
                id="grupo"
                className="campo"
                value={form.grupo}
                onChange={(e) => setForm((a) => ({ ...a, grupo: e.target.value }))}
                placeholder="Ex: Hortifruti / Natural da Terra / HNT"
              />
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-1.5 flex items-center gap-2">
              <p className="eyebrow">Faixas de desconto</p>
              <button
                className="btn-mini ml-auto"
                onClick={() =>
                  setForm((a) => ({
                    ...a,
                    regras: [
                      ...a.regras,
                      {
                        id: `nova-${a.regras.length + 1}`,
                        rotulo: "",
                        categoria: "geral",
                        uf: "",
                        percentual: "",
                        padrao: false,
                      },
                    ],
                  }))
                }
              >
                + faixa
              </button>
            </div>

            {form.regras.length === 0 && (
              <p className="aviso aviso-alerta mb-2">
                Sem faixas: este contrato só serve para fixar o banco de cobrança (caso Smart
                Break).
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              {form.regras.map((regra, indice) => (
                <div
                  key={regra.id}
                  className="grid items-end gap-2 rounded-md border border-borda bg-cartao-alt px-2.5 py-2 md:grid-cols-[1fr_130px_70px_110px_90px_32px]"
                >
                  <div>
                    <label className="rotulo">Rótulo</label>
                    <input
                      className="campo"
                      value={regra.rotulo}
                      placeholder="ex: secos SP"
                      onChange={(e) =>
                        setForm((a) => ({
                          ...a,
                          regras: a.regras.map((r, i) =>
                            i === indice ? { ...r, rotulo: e.target.value } : r,
                          ),
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="rotulo">Categoria</label>
                    <select
                      className="campo"
                      value={regra.categoria}
                      onChange={(e) =>
                        setForm((a) => ({
                          ...a,
                          regras: a.regras.map((r, i) =>
                            i === indice
                              ? { ...r, categoria: e.target.value as CategoriaProduto }
                              : r,
                          ),
                        }))
                      }
                    >
                      <option value="geral">geral</option>
                      <option value="secos">secos</option>
                      <option value="congelados">congelados</option>
                    </select>
                  </div>
                  <div>
                    <label className="rotulo">UF</label>
                    <input
                      className="campo"
                      maxLength={2}
                      value={regra.uf}
                      onChange={(e) =>
                        setForm((a) => ({
                          ...a,
                          regras: a.regras.map((r, i) =>
                            i === indice ? { ...r, uf: e.target.value.toUpperCase() } : r,
                          ),
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="rotulo">Percentual</label>
                    <input
                      className="campo-num"
                      inputMode="decimal"
                      value={regra.percentual}
                      onChange={(e) =>
                        setForm((a) => ({
                          ...a,
                          regras: a.regras.map((r, i) =>
                            i === indice ? { ...r, percentual: e.target.value } : r,
                          ),
                        }))
                      }
                    />
                  </div>
                  <label className="flex h-[30px] items-center gap-1.5 text-[11.5px]">
                    <input
                      type="radio"
                      name="regra-padrao"
                      checked={regra.padrao}
                      onChange={() =>
                        setForm((a) => ({
                          ...a,
                          regras: a.regras.map((r, i) => ({ ...r, padrao: i === indice })),
                        }))
                      }
                    />
                    padrão
                  </label>
                  <button
                    className="btn-mini"
                    title="Remover faixa"
                    onClick={() =>
                      setForm((a) => ({
                        ...a,
                        regras: a.regras.filter((_, i) => i !== indice),
                      }))
                    }
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-fraco">
              Marque “padrão” só quando existir um percentual óbvio. Sem padrão, o operador é
              obrigado a escolher a faixa no momento do desconto.
            </p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div>
              <label className="rotulo" htmlFor="conta-pref">
                Banco / conta corrente do contrato
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
                    {conta.banco ? ` — ${conta.banco}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex h-[30px] items-center gap-2 text-[12.5px]">
                <input
                  type="checkbox"
                  checked={form.aplicarContaSempre}
                  onChange={(e) =>
                    setForm((a) => ({ ...a, aplicarContaSempre: e.target.checked }))
                  }
                />
                Sempre mover o título para esta conta
              </label>
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
