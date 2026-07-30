"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Perfil } from "@/lib/types";

const ITENS = [
  { href: "/titulos", rotulo: "Títulos", icone: "▦" },
  { href: "/clientes", rotulo: "Clientes especiais", icone: "★" },
  { href: "/auditoria", rotulo: "Auditoria", icone: "⧗" },
  { href: "/configuracoes", rotulo: "Configurações", icone: "⚙" },
];

export function Sidebar({
  nome,
  perfil,
}: {
  nome: string;
  perfil: Perfil;
}) {
  const caminho = usePathname();
  const router = useRouter();

  async function sair() {
    await fetch("/api/login", { method: "DELETE" });
    router.replace("/login");
  }

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-borda bg-cartao md:h-screen md:w-60 md:border-r md:border-b-0">
      <div className="px-4 py-4">
        <p className="text-[11px] font-semibold tracking-widest text-acento uppercase">
          Financeiro
        </p>
        <p className="text-sm font-semibold tracking-tight">Contas a Receber</p>
      </div>

      <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:overflow-visible">
        {ITENS.map((item) => {
          const ativo = caminho.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition ${
                ativo
                  ? "bg-acento-suave font-medium text-acento"
                  : "text-suave hover:bg-cartao-alt hover:text-texto"
              }`}
            >
              <span aria-hidden>{item.icone}</span>
              {item.rotulo}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto hidden border-t border-borda p-4 md:block">
        <p className="truncate text-sm font-medium">{nome}</p>
        <p className="mb-3 text-xs text-suave capitalize">{perfil}</p>
        <button onClick={sair} className="btn-mini w-full">
          Sair
        </button>
      </div>
    </aside>
  );
}
