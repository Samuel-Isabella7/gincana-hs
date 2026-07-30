"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import type { Perfil } from "@/lib/types";

const EVENTO_TEMA = "tema:mudou";

function assinarTema(aoMudar: () => void) {
  window.addEventListener(EVENTO_TEMA, aoMudar);
  return () => window.removeEventListener(EVENTO_TEMA, aoMudar);
}

function lerTema(): "light" | "dark" {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

const ITENS = [
  { href: "/titulos", rotulo: "Títulos" },
  { href: "/clientes", rotulo: "Clientes especiais" },
  { href: "/parcelamentos", rotulo: "Parcelamentos" },
  { href: "/aprovacoes", rotulo: "Aprovações", contador: true },
  { href: "/auditoria", rotulo: "Auditoria" },
  { href: "/configuracoes", rotulo: "Configurações" },
];

export function Sidebar({
  nome,
  usuario,
  perfil,
  aprovacoesPendentes,
}: {
  nome: string;
  usuario: string;
  perfil: Perfil;
  aprovacoesPendentes: number;
}) {
  const caminho = usePathname();
  const router = useRouter();
  // O tema vive no atributo data-theme do <html> (aplicado antes da hidratação).
  const tema = useSyncExternalStore(assinarTema, lerTema, () => "light" as const);

  function alternarTema() {
    const proximo = tema === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", proximo);
    localStorage.setItem("tema", proximo);
    window.dispatchEvent(new Event(EVENTO_TEMA));
  }

  async function sair() {
    await fetch("/api/login", { method: "DELETE" });
    router.replace("/login");
  }

  const iniciais = nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join("");

  return (
    <aside className="sticky top-0 flex h-screen w-[212px] shrink-0 flex-col border-r border-borda bg-cartao">
      <div className="flex items-baseline gap-1.5 px-3.5 py-3.5">
        <span className="text-[14.5px] font-bold tracking-[0.13em]">KALENA</span>
        <span className="text-[10px] font-semibold tracking-[0.13em] text-fraco">FOODS</span>
      </div>
      <div className="border-b border-borda" />

      <p className="px-3.5 pt-3.5 pb-1.5 text-[9.5px] font-bold tracking-[0.07em] text-fraco uppercase">
        Financeiro
      </p>

      <nav className="flex flex-col gap-0.5 px-2">
        {ITENS.map((item) => {
          const ativo = caminho.startsWith(item.href);
          const mostrarBadge = item.contador && aprovacoesPendentes > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex h-[31px] items-center gap-2 rounded-md px-2.5 text-[12.5px] transition ${
                ativo
                  ? "bg-acento-suave font-semibold text-acento"
                  : "text-suave hover:bg-cartao-3 hover:text-texto"
              }`}
            >
              {ativo && (
                <span className="absolute top-1/2 left-0 h-3.5 w-0.5 -translate-y-1/2 rounded-r bg-acento" />
              )}
              <span className="flex-1">{item.rotulo}</span>
              {mostrarBadge && (
                <span className="selo bg-negativo-suave text-negativo">
                  {aprovacoesPendentes}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-borda p-3.5">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-[26px] w-[26px] items-center justify-center rounded-[5px] bg-acento-suave text-[11px] font-semibold text-acento">
            {iniciais || "US"}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[12.5px] font-medium">{nome}</span>
            <span className="block truncate text-[11px] text-fraco">
              {perfil === "gestor" ? "Gestor" : "Operador financeiro"} · {usuario}
            </span>
          </span>
        </div>
        <div className="flex gap-1.5">
          <button className="btn-mini flex-1" onClick={alternarTema} title="Alternar tema">
            {tema === "dark" ? "☀ Claro" : "☾ Escuro"}
          </button>
          <button className="btn-mini flex-1" onClick={sair}>
            Sair
          </button>
        </div>
      </div>
    </aside>
  );
}
