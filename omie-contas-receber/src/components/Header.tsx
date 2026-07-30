import { dataHoraBr } from "@/lib/format";

/**
 * Cabeçalho de 52px: título da tela, origem dos dados em mono e o chip de
 * modo demonstração à direita.
 */
export function Header({
  titulo,
  fonte,
  demonstracao,
  acoes,
}: {
  titulo: string;
  fonte: string;
  demonstracao: boolean;
  acoes?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-5 flex h-[52px] items-center gap-3.5 border-b border-borda bg-cartao px-[22px]">
      <h1 className="text-[14.5px] font-semibold">{titulo}</h1>
      <span className="mono truncate text-[11.5px] text-fraco">{fonte}</span>

      <div className="ml-auto flex items-center gap-3">
        {acoes}
        {demonstracao && (
          <span className="selo bg-alerta-suave text-alerta">
            <span className="ponto ponto-pulsante" style={{ background: "var(--warn)" }} />
            Modo demonstração
          </span>
        )}
        <span className="mono hidden text-[11px] text-fraco md:inline">
          últ. sinc. {dataHoraBr(new Date().toISOString())}
        </span>
      </div>
    </header>
  );
}
