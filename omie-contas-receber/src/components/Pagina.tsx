import { Header } from "./Header";

/** Casca de uma tela interna: cabeçalho fixo + conteúdo com a densidade do design. */
export function Pagina({
  titulo,
  fonte,
  demonstracao,
  acoes,
  children,
}: {
  titulo: string;
  fonte: string;
  demonstracao: boolean;
  acoes?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <Header titulo={titulo} fonte={fonte} demonstracao={demonstracao} acoes={acoes} />
      <div className="flex flex-col gap-4 px-[22px] pt-5 pb-16">{children}</div>
    </>
  );
}
