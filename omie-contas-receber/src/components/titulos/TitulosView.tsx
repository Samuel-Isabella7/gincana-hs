"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { BoletoModal } from "./BoletoModal";
import { ContaCorrenteModal } from "./ContaCorrenteModal";
import { DescontoModal } from "./DescontoModal";
import { ParcelamentoModal } from "./ParcelamentoModal";
import { ROTULOS_STATUS, StatusSelo } from "./StatusSelo";
import { useToast } from "@/components/ui/Toasts";
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
  porPagina,
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
  porPagina: number;
  venceDe: string;
  venceAte: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [emTransicao, iniciarTransicao] = useTransition();

  const [texto, setTexto] = useState("");
  const [status, setStatus] = useState<StatusTitulo | "">("");
  const [contaFiltro, setContaFiltro] = useState("");
  const [valorMinimo, setValorMinimo] = useState("");
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
    const minimo = Number(valorMinimo.replace(",", ".")) || 0;
    return titulos.filter((titulo) => {
      if (busca) {
        const alvo = `${titulo.clienteNome} ${titulo.clienteCnpj} ${titulo.numeroDocumento} ${titulo.numeroTitulo}`.toLowerCase();
        if (!alvo.includes(busca)) return false;
      }
      if (status && titulo.status !== status) return false;
      if (contaFiltro && String(titulo.contaCorrenteId) !== contaFiltro) return false;
      if (minimo && titulo.saldo < minimo) return false;
      if (somenteEspeciais && !contratoDe(titulo)) return false;
      if (somenteSemBoleto && titulo.boletoEmitido) return false;
      return true;
    });
  }, [
    titulos,
    texto,
    status,
    contaFiltro,
    valorMinimo,
    somenteEspeciais,
    somenteSemBoleto,
    contratoDe,
  ]);

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
      selecionado: selecionadosTitulos.reduce((s, t) => s + t.saldo, 0),
    };
  }, [filtrados, selecionadosTitulos]);

  const todosMarcados =
    filtrados.length > 0 && filtrados.every((t) => selecionados.includes(t.id));

  function navegar(mudancas: Record<string, string>) {
    const parametros = new URLSearchParams({
      venceDe,
      venceAte,
      pagina: String(pagina),
      porPagina: String(porPagina),
      ...mudancas,
    });
    iniciarTransicao(() => router.push(`/titulos?${parametros.toString()}`));
  }

  function limparFiltros() {
    setTexto("");
    setStatus("");
    setContaFiltro("");
    setValorMinimo("");
    setSomenteEspeciais(false);
    setSomenteSemBoleto(false);
  }

  function aoConcluir(mensagem?: string) {
    setSelecionados([]);
    if (mensagem) toast(mensagem);
    iniciarTransicao(() => router.refresh());
  }

  const inicio = totalRegistros === 0 ? 0 : (pagina - 1) * porPagina + 1;
  const fim = Math.min(pagina * porPagina, totalRegistros);

  return (
    <>
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Indicador
          rotulo="Total a receber"
          valor={moeda(resumo.aReceber)}
          nota={`${filtrados.length} título(s) no filtro`}
        />
        <Indicador
          rotulo="Total vencido"
          valor={moeda(resumo.vencido)}
          nota="saldo em atraso"
          tom="negativo"
        />
        <Indicador
          rotulo="Descontos lançados"
          valor={moeda(resumo.descontos)}
          nota="já aplicados nos títulos listados"
          tom="acento"
        />
        <Indicador
          rotulo="Títulos sem boleto"
          valor={String(resumo.semBoleto)}
          nota="aguardando emissão"
          tom="alerta"
        />
      </section>

      <section className="cartao flex flex-wrap items-end gap-2 bg-cartao-alt p-2.5">
        <div className="w-[268px]">
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
        <div className="w-[140px]">
          <label className="rotulo" htmlFor="vence-de">
            Vence de
          </label>
          <input
            id="vence-de"
            type="date"
            className="campo"
            value={venceDe}
            onChange={(e) => navegar({ venceDe: e.target.value, pagina: "1" })}
          />
        </div>
        <div className="w-[140px]">
          <label className="rotulo" htmlFor="vence-ate">
            Vence até
          </label>
          <input
            id="vence-ate"
            type="date"
            className="campo"
            value={venceAte}
            onChange={(e) => navegar({ venceAte: e.target.value, pagina: "1" })}
          />
        </div>
        <div className="w-[130px]">
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
        <div className="w-[170px]">
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
        <div className="w-[110px]">
          <label className="rotulo" htmlFor="valor-min">
            Saldo mín.
          </label>
          <input
            id="valor-min"
            className="campo-num"
            inputMode="decimal"
            value={valorMinimo}
            onChange={(e) => setValorMinimo(e.target.value)}
            placeholder="0,00"
          />
        </div>

        <label className="flex h-[30px] items-center gap-1.5 text-[12.5px]">
          <input
            type="checkbox"
            checked={somenteEspeciais}
            onChange={(e) => setSomenteEspeciais(e.target.checked)}
          />
          Somente clientes especiais
        </label>
        <label className="flex h-[30px] items-center gap-1.5 text-[12.5px]">
          <input
            type="checkbox"
            checked={somenteSemBoleto}
            onChange={(e) => setSomenteSemBoleto(e.target.checked)}
          />
          Somente sem boleto
        </label>

        <button className="btn ml-auto" onClick={limparFiltros}>
          Limpar
        </button>
      </section>

      {selecionados.length > 0 && (
        <section className="barra-lote sticky top-[52px] z-20">
          <span className="text-[12.5px] font-semibold text-acento">
            {selecionados.length} selecionado(s)
          </span>
          <span className="mono text-[12px] text-suave">{moeda(resumo.selecionado)}</span>
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
              selecionados.length !== 1 ? "Selecione exatamente 1 título para parcelar" : undefined
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

      <section className="cartao cartao-sombra overflow-hidden">
        <div className="max-h-[calc(100vh-330px)] overflow-auto">
          <table className="tabela">
            <thead>
              <tr>
                <th className="w-9 pl-3">
                  <input
                    type="checkbox"
                    checked={todosMarcados}
                    onChange={() =>
                      setSelecionados(todosMarcados ? [] : filtrados.map((t) => t.id))
                    }
                    aria-label="Selecionar todos"
                  />
                </th>
                <th>Cliente</th>
                <th>Documento</th>
                <th className="text-center">Parc.</th>
                <th className="text-right">Emissão</th>
                <th className="text-right">Vencimento</th>
                <th className="text-right">Valor orig.</th>
                <th className="text-right">Desconto</th>
                <th className="text-right">Saldo</th>
                <th>Conta</th>
                <th>Status</th>
                <th>Boleto</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((titulo) => {
                const contrato = contratoDe(titulo);
                const marcado = selecionados.includes(titulo.id);
                const vencido = titulo.status === "VENCIDO";
                return (
                  <tr key={titulo.id} className={marcado ? "selecionada" : undefined}>
                    <td className="pl-3">
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={() =>
                          setSelecionados((atual) =>
                            atual.includes(titulo.id)
                              ? atual.filter((x) => x !== titulo.id)
                              : [...atual, titulo.id],
                          )
                        }
                        aria-label={`Selecionar título ${titulo.id}`}
                      />
                    </td>
                    <td className="max-w-[250px]">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-medium">{titulo.clienteNome}</span>
                        {contrato && (
                          <span className="selo-contrato">
                            Contrato −{percentual(contrato.percentualDesconto)}
                          </span>
                        )}
                      </div>
                      <div className="mono text-[10.5px] text-fraco">
                        {formatarCnpj(titulo.clienteCnpj)}
                      </div>
                    </td>
                    <td className="mono text-[12px]">{titulo.numeroDocumento || "—"}</td>
                    <td className="mono text-center text-[11.5px] text-suave">
                      {titulo.parcela || "—"}
                    </td>
                    <td className="num text-suave">{dataBr(titulo.emissao)}</td>
                    <td className={`num ${vencido ? "font-semibold text-negativo" : ""}`}>
                      {dataBr(titulo.vencimento)}
                    </td>
                    <td className="num">{moeda(titulo.valorOriginal)}</td>
                    <td className="num">
                      {titulo.valorDesconto > 0 ? (
                        <span className="text-negativo">−{moeda(titulo.valorDesconto)}</span>
                      ) : (
                        <span className="text-fraco">—</span>
                      )}
                    </td>
                    <td className="num font-semibold">{moeda(titulo.saldo)}</td>
                    <td className="max-w-[150px] truncate text-[12px]">
                      {titulo.contaCorrenteNome ?? "—"}
                    </td>
                    <td>
                      <StatusSelo status={titulo.status} />
                    </td>
                    <td>
                      {titulo.boletoLink ? (
                        <a
                          href={titulo.boletoLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11.5px]"
                        >
                          emitido ↓
                        </a>
                      ) : (
                        <span className="mono text-[11px] text-fraco">
                          {titulo.boletoEmitido ? "emitido" : "não emitido"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={12} className="py-12 text-center">
                    <div className="mx-auto max-w-sm rounded-lg border border-dashed border-borda p-6">
                      <p className="text-[13.5px] font-semibold">Nenhum título encontrado</p>
                      <p className="mt-1 text-[12.5px] text-fraco">
                        Ajuste os filtros ou o período de vencimento.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-borda bg-cartao-alt px-3 py-2 text-[12px]">
          <span className="text-suave">
            {inicio}–{fim} de {totalRegistros} títulos no período
          </span>
          <label className="flex items-center gap-1.5 text-suave">
            por página
            <select
              className="campo w-[74px]"
              value={porPagina}
              onChange={(e) => navegar({ porPagina: e.target.value, pagina: "1" })}
            >
              {[50, 100, 200].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <div className="ml-auto flex items-center gap-2">
            <button
              className="btn-mini"
              disabled={pagina <= 1 || emTransicao}
              onClick={() => navegar({ pagina: String(pagina - 1) })}
            >
              ‹ Anterior
            </button>
            <span className="mono text-[11.5px] text-suave">
              {pagina} / {totalPaginas}
            </span>
            <button
              className="btn-mini"
              disabled={pagina >= totalPaginas || emTransicao}
              onClick={() => navegar({ pagina: String(pagina + 1) })}
            >
              Próxima ›
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
    </>
  );
}

function Indicador({
  rotulo,
  valor,
  nota,
  tom,
}: {
  rotulo: string;
  valor: string;
  nota: string;
  tom?: "negativo" | "acento" | "alerta";
}) {
  const cor =
    tom === "negativo"
      ? "text-negativo"
      : tom === "acento"
        ? "text-acento"
        : tom === "alerta"
          ? "text-alerta"
          : "text-texto";
  return (
    <div className="cartao flex flex-col gap-1.5 px-3.5 py-3.5">
      <span className="eyebrow">{rotulo}</span>
      <span className={`mono text-[21px] leading-none font-semibold ${cor}`}>{valor}</span>
      <span className="text-[11px] text-fraco">{nota}</span>
    </div>
  );
}
