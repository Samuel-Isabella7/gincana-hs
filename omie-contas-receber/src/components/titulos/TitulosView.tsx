"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { BoletoModal } from "./BoletoModal";
import { ContaCorrenteModal } from "./ContaCorrenteModal";
import { DescontoModal } from "./DescontoModal";
import { ParcelamentoModal } from "./ParcelamentoModal";
import { ROTULOS_STATUS, StatusSelo } from "./StatusSelo";
import { contratoVigente } from "@/lib/desconto";
import { dataBr, formatarCnpj, moeda, percentual } from "@/lib/format";
import type {
  Config,
  ContaCorrente,
  Contrato,
  Perfil,
  StatusTitulo,
  Titulo,
} from "@/lib/types";

type ModalAberto = "desconto" | "boleto" | "conta" | "parcelamento" | null;

export function TitulosView({
  titulos,
  contratos,
  contas,
  config,
  perfil,
  pagina,
  totalPaginas,
  totalRegistros,
  venceDe,
  venceAte,
}: {
  titulos: Titulo[];
  contratos: Contrato[];
  contas: ContaCorrente[];
  config: Config;
  perfil: Perfil;
  pagina: number;
  totalPaginas: number;
  totalRegistros: number;
  venceDe: string;
  venceAte: string;
}) {
  const router = useRouter();
  const [emTransicao, iniciarTransicao] = useTransition();

  const [texto, setTexto] = useState("");
  const [status, setStatus] = useState<StatusTitulo | "">("");
  const [contaFiltro, setContaFiltro] = useState("");
  const [somenteEspeciais, setSomenteEspeciais] = useState(false);
  const [somenteSemBoleto, setSomenteSemBoleto] = useState(false);
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [modal, setModal] = useState<ModalAberto>(null);

  const contratoDe = useMemo(
    () => (titulo: Titulo) => contratoVigente(contratos, titulo.clienteId),
    [contratos],
  );

  const filtrados = useMemo(() => {
    const busca = texto.trim().toLowerCase();
    return titulos.filter((titulo) => {
      if (busca) {
        const alvo = `${titulo.clienteNome} ${titulo.clienteCnpj} ${titulo.numeroDocumento} ${titulo.numeroTitulo}`.toLowerCase();
        if (!alvo.includes(busca)) return false;
      }
      if (status && titulo.status !== status) return false;
      if (contaFiltro && String(titulo.contaCorrenteId) !== contaFiltro) return false;
      if (somenteEspeciais && !contratoDe(titulo)) return false;
      if (somenteSemBoleto && titulo.boletoEmitido) return false;
      return true;
    });
  }, [titulos, texto, status, contaFiltro, somenteEspeciais, somenteSemBoleto, contratoDe]);

  const selecionadosTitulos = useMemo(
    () => titulos.filter((t) => selecionados.includes(t.id)),
    [titulos, selecionados],
  );

  const resumo = useMemo(() => {
    const abertos = filtrados.filter((t) => t.status !== "CANCELADO" && t.saldo > 0);
    return {
      aReceber: abertos.reduce((s, t) => s + t.saldo, 0),
      vencido: abertos.filter((t) => t.status === "VENCIDO").reduce((s, t) => s + t.saldo, 0),
      descontos: filtrados.reduce((s, t) => s + t.valorDesconto, 0),
      semBoleto: abertos.filter((t) => !t.boletoEmitido).length,
    };
  }, [filtrados]);

  const todosMarcados =
    filtrados.length > 0 && filtrados.every((t) => selecionados.includes(t.id));

  function alternarTodos() {
    setSelecionados(todosMarcados ? [] : filtrados.map((t) => t.id));
  }

  function alternar(id: number) {
    setSelecionados((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id],
    );
  }

  function aplicarPeriodo(campo: "venceDe" | "venceAte", valor: string) {
    const parametros = new URLSearchParams({ venceDe, venceAte });
    parametros.set(campo, valor);
    parametros.set("pagina", "1");
    iniciarTransicao(() => router.push(`/titulos?${parametros.toString()}`));
  }

  function irParaPagina(destino: number) {
    const parametros = new URLSearchParams({
      venceDe,
      venceAte,
      pagina: String(destino),
    });
    iniciarTransicao(() => router.push(`/titulos?${parametros.toString()}`));
  }

  function aoConcluir() {
    setSelecionados([]);
    iniciarTransicao(() => router.refresh());
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Contas a receber</h1>
          <p className="text-sm text-suave">
            {totalRegistros} título(s) no período · página {pagina} de {totalPaginas}
          </p>
        </div>
        <button
          className="btn"
          onClick={() => iniciarTransicao(() => router.refresh())}
          disabled={emTransicao}
        >
          {emTransicao ? "Atualizando…" : "Atualizar"}
        </button>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador rotulo="Total a receber" valor={moeda(resumo.aReceber)} />
        <Indicador rotulo="Vencido" valor={moeda(resumo.vencido)} tom="negativo" />
        <Indicador rotulo="Descontos lançados" valor={moeda(resumo.descontos)} tom="acento" />
        <Indicador rotulo="Sem boleto" valor={String(resumo.semBoleto)} />
      </section>

      <section className="cartao p-3">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <div className="xl:col-span-2">
            <label className="rotulo" htmlFor="busca">
              Cliente, CNPJ ou documento
            </label>
            <input
              id="busca"
              className="campo"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Buscar…"
            />
          </div>
          <div>
            <label className="rotulo" htmlFor="filtro-status">
              Status
            </label>
            <select
              id="filtro-status"
              className="campo"
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusTitulo | "")}
            >
              <option value="">Todos</option>
              {ROTULOS_STATUS.map((s) => (
                <option key={s.valor} value={s.valor}>
                  {s.rotulo}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="rotulo" htmlFor="filtro-conta">
              Banco / conta
            </label>
            <select
              id="filtro-conta"
              className="campo"
              value={contaFiltro}
              onChange={(e) => setContaFiltro(e.target.value)}
            >
              <option value="">Todas</option>
              {contas.map((conta) => (
                <option key={conta.id} value={conta.id}>
                  {conta.descricao}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="rotulo" htmlFor="vence-de">
              Vence de
            </label>
            <input
              id="vence-de"
              type="date"
              className="campo"
              value={venceDe}
              onChange={(e) => aplicarPeriodo("venceDe", e.target.value)}
            />
          </div>
          <div>
            <label className="rotulo" htmlFor="vence-ate">
              Vence até
            </label>
            <input
              id="vence-ate"
              type="date"
              className="campo"
              value={venceAte}
              onChange={(e) => aplicarPeriodo("venceAte", e.target.value)}
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={somenteEspeciais}
              onChange={(e) => setSomenteEspeciais(e.target.checked)}
            />
            Somente clientes especiais
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={somenteSemBoleto}
              onChange={(e) => setSomenteSemBoleto(e.target.checked)}
            />
            Somente sem boleto
          </label>
        </div>
      </section>

      {selecionados.length > 0 && (
        <section className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-acento/30 bg-acento-suave px-3 py-2">
          <span className="text-sm font-medium text-acento">
            {selecionados.length} selecionado(s)
          </span>
          <button className="btn-primario" onClick={() => setModal("desconto")}>
            Aplicar desconto de contrato
          </button>
          <button className="btn" onClick={() => setModal("boleto")}>
            Emitir boleto
          </button>
          <button className="btn" onClick={() => setModal("conta")}>
            Trocar conta bancária
          </button>
          <button
            className="btn"
            disabled={selecionados.length !== 1}
            title={
              selecionados.length !== 1 ? "Selecione um único título para parcelar" : undefined
            }
            onClick={() => setModal("parcelamento")}
          >
            Parcelar
          </button>
          <button className="btn-mini ml-auto" onClick={() => setSelecionados([])}>
            Limpar seleção
          </button>
        </section>
      )}

      <section className="cartao overflow-hidden">
        <div className="max-h-[62vh] overflow-auto">
          <table className="tabela">
            <thead>
              <tr>
                <th className="w-10">
                  <input
                    type="checkbox"
                    checked={todosMarcados}
                    onChange={alternarTodos}
                    aria-label="Selecionar todos"
                  />
                </th>
                <th>Cliente</th>
                <th>Documento</th>
                <th>Parcela</th>
                <th>Vencimento</th>
                <th className="num">Valor original</th>
                <th className="num">Desconto</th>
                <th className="num">Saldo</th>
                <th>Conta corrente</th>
                <th>Status</th>
                <th>Boleto</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((titulo) => {
                const contrato = contratoDe(titulo);
                const marcado = selecionados.includes(titulo.id);
                return (
                  <tr key={titulo.id} className={marcado ? "bg-acento-suave/50" : undefined}>
                    <td>
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={() => alternar(titulo.id)}
                        aria-label={`Selecionar título ${titulo.id}`}
                      />
                    </td>
                    <td>
                      <div className="font-medium">{titulo.clienteNome}</div>
                      <div className="flex items-center gap-2 text-xs text-suave">
                        <span>{formatarCnpj(titulo.clienteCnpj)}</span>
                        {contrato && (
                          <span className="selo bg-acento-suave text-acento">
                            Contrato −{percentual(contrato.percentualDesconto)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap">{titulo.numeroDocumento || "—"}</td>
                    <td className="whitespace-nowrap">{titulo.parcela || "—"}</td>
                    <td className="whitespace-nowrap">{dataBr(titulo.vencimento)}</td>
                    <td className="num">{moeda(titulo.valorOriginal)}</td>
                    <td className="num">
                      {titulo.valorDesconto > 0 ? (
                        <span className="text-acento">{moeda(titulo.valorDesconto)}</span>
                      ) : (
                        <span className="text-suave">—</span>
                      )}
                    </td>
                    <td className="num font-medium">{moeda(titulo.saldo)}</td>
                    <td className="whitespace-nowrap">{titulo.contaCorrenteNome ?? "—"}</td>
                    <td>
                      <StatusSelo status={titulo.status} />
                    </td>
                    <td>
                      {titulo.boletoLink ? (
                        <a
                          href={titulo.boletoLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-acento underline"
                        >
                          abrir
                        </a>
                      ) : (
                        <span className="text-xs text-suave">
                          {titulo.boletoEmitido ? "emitido" : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-sm text-suave">
                    Nenhum título encontrado com os filtros atuais.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-borda px-3 py-2 text-sm">
          <span className="text-suave">
            Exibindo {filtrados.length} de {titulos.length} título(s) carregados
          </span>
          <div className="flex gap-2">
            <button
              className="btn-mini"
              disabled={pagina <= 1 || emTransicao}
              onClick={() => irParaPagina(pagina - 1)}
            >
              Anterior
            </button>
            <button
              className="btn-mini"
              disabled={pagina >= totalPaginas || emTransicao}
              onClick={() => irParaPagina(pagina + 1)}
            >
              Próxima
            </button>
          </div>
        </div>
      </section>

      {modal === "desconto" && (
        <DescontoModal
          titulos={selecionadosTitulos}
          contratos={contratos}
          contas={contas}
          config={config}
          perfil={perfil}
          onFechar={() => setModal(null)}
          onConcluido={aoConcluir}
        />
      )}

      {modal === "boleto" && (
        <BoletoModal
          titulos={selecionadosTitulos}
          onFechar={() => setModal(null)}
          onConcluido={aoConcluir}
        />
      )}

      {modal === "conta" && (
        <ContaCorrenteModal
          titulos={selecionadosTitulos}
          contas={contas}
          onFechar={() => setModal(null)}
          onConcluido={aoConcluir}
        />
      )}

      {modal === "parcelamento" && selecionadosTitulos[0] && (
        <ParcelamentoModal
          titulo={selecionadosTitulos[0]}
          contas={contas}
          onFechar={() => setModal(null)}
          onConcluido={aoConcluir}
        />
      )}
    </div>
  );
}

function Indicador({
  rotulo,
  valor,
  tom,
}: {
  rotulo: string;
  valor: string;
  tom?: "negativo" | "acento";
}) {
  const cor =
    tom === "negativo" ? "text-negativo" : tom === "acento" ? "text-acento" : "text-texto";
  return (
    <div className="cartao px-4 py-3">
      <p className="text-xs text-suave">{rotulo}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${cor}`}>{valor}</p>
    </div>
  );
}
