"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type TipoToast = "ok" | "erro" | "info";

interface Toast {
  id: number;
  tipo: TipoToast;
  mensagem: string;
}

const Contexto = createContext<(mensagem: string, tipo?: TipoToast) => void>(() => {});

export function useToast() {
  return useContext(Contexto);
}

const CORES: Record<TipoToast, string> = {
  ok: "var(--pos)",
  erro: "var(--neg)",
  info: "var(--accent)",
};

export function ProvedorToasts({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const mostrar = useCallback((mensagem: string, tipo: TipoToast = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((atual) => [...atual, { id, tipo, mensagem }]);
    setTimeout(() => {
      setToasts((atual) => atual.filter((t) => t.id !== id));
    }, 2600);
  }, []);

  const valor = useMemo(() => mostrar, [mostrar]);

  return (
    <Contexto.Provider value={valor}>
      {children}
      <div className="pointer-events-none fixed right-5 bottom-5 z-100 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="cartao cartao-sombra pointer-events-auto max-w-sm px-3 py-2 text-[12.5px]"
            style={{
              borderLeft: `3px solid ${CORES[toast.tipo]}`,
              animation: "slidein .18s ease-out",
            }}
          >
            {toast.mensagem}
          </div>
        ))}
      </div>
    </Contexto.Provider>
  );
}
