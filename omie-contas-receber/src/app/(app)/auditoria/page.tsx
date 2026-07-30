import { EventosView } from "@/components/auditoria/EventosView";
import { Pagina } from "@/components/Pagina";
import { exigirSessao } from "@/lib/auth";
import { modoDemonstracao } from "@/lib/omie/service";
import { listarEventos } from "@/lib/store";
import type { AcaoAuditoria } from "@/lib/types";

export const dynamic = "force-dynamic";

interface Parametros {
  acao?: string;
  usuario?: string;
  de?: string;
  ate?: string;
}

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<Parametros>;
}) {
  await exigirSessao();
  const parametros = await searchParams;

  const eventos = await listarEventos({
    acao: (parametros.acao as AcaoAuditoria) || undefined,
    usuario: parametros.usuario || undefined,
    de: parametros.de || undefined,
    ate: parametros.ate || undefined,
    limite: 300,
  });

  return (
    <Pagina titulo="Auditoria" fonte="supabase · auditoria" demonstracao={modoDemonstracao()}>
      <EventosView
        eventos={eventos}
        filtros={{
          acao: parametros.acao ?? "",
          usuario: parametros.usuario ?? "",
          de: parametros.de ?? "",
          ate: parametros.ate ?? "",
        }}
      />
    </Pagina>
  );
}
