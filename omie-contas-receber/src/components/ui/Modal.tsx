"use client";

import { useEffect } from "react";

export function Modal({
  titulo,
  descricao,
  largura = "max-w-3xl",
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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 md:items-center">
      <div
        className={`cartao w-full ${largura} my-auto shadow-xl`}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
      >
        <div className="flex items-start justify-between gap-4 border-b border-borda px-5 py-4">
          <div>
            <h2 className="titulo-secao">{titulo}</h2>
            {descricao && <p className="mt-1 text-sm text-suave">{descricao}</p>}
          </div>
          <button
            onClick={onFechar}
            className="btn-mini"
            aria-label="Fechar"
            type="button"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto px-5 py-4">{children}</div>

        {rodape && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-borda px-5 py-4">
            {rodape}
          </div>
        )}
      </div>
    </div>
  );
}
