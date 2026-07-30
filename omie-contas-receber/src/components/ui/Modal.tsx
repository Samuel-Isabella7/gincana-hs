"use client";

import { useEffect } from "react";

export function Modal({
  titulo,
  descricao,
  largura = "max-w-[1000px]",
  onFechar,
  children,
  rodape,
}: {
  titulo: string;
  descricao?: string;
  largura?: string;
  onFechar: () => void;
  children: React.ReactNode;
  rodape?: React.ReactNode;
}) {
  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") onFechar();
    }
    document.addEventListener("keydown", aoTeclar);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = "";
    };
  }, [onFechar]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-5 md:items-center"
      style={{ background: "rgba(9,13,18,.5)" }}
    >
      <div
        className={`modal-card w-full ${largura} my-auto flex max-h-full flex-col overflow-hidden border border-borda bg-cartao`}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
      >
        <div className="flex items-start justify-between gap-4 border-b border-borda px-4 py-3">
          <div>
            <h2 className="text-[14.5px] font-semibold">{titulo}</h2>
            {descricao && (
              <p className="mt-0.5 text-[11.5px] text-fraco">{descricao}</p>
            )}
          </div>
          <button
            onClick={onFechar}
            className="cursor-pointer text-[14px] text-fraco transition hover:text-negativo"
            aria-label="Fechar"
            type="button"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5">{children}</div>

        {rodape && (
          <div className="flex flex-wrap items-center gap-2 border-t border-borda bg-cartao-alt px-4 py-3">
            {rodape}
          </div>
        )}
      </div>
    </div>
  );
}
