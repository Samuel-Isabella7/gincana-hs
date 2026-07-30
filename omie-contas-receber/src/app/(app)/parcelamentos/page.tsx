import { Pagina } from "@/components/Pagina";
import { exigirSessao } from "@/lib/auth";
import { dataHoraBr, moeda } from "@/lib/format";
import { modoDemonstracao } from "@/lib/omie/service";
import { listarParcelamentos } from "@/lib/store";

export const dynamic = "force-dynamic";

const POLITICA: Record<string, string> = {
  baixado: "baixado como parcelado",
  excluido: "excluído do Omie",
};

export default async function ParcelamentosPage() {
  await exigirSessao();
  const parcelamentos = await listarParcelamentos();

  return (
    <Pagina
      titulo="Parcelamentos"
      fonte="supabase · parcelamentos"
      demonstracao={modoDemonstracao()}
    >
      <section className="cartao cartao-sombra overflow-hidden">
        <div className="overflow-x-auto">
          <table className="tabela">
            <thead>
              <tr>
                <th>Título de origem</th>
                <th>Cliente</th>
                <th className="text-center">Parcelas</th>
                <th className="text-right">Valor total</th>
                <th>Política do original</th>
                <th>Boletos</th>
                <th>Usuário</th>
                <th>Criado em</th>
              </tr>
            </thead>
            <tbody>
              {parcelamentos.map((registro) => {
                const emitidos = registro.boletosEmitidos;
                const total = registro.titulosGerados.length;
                const tom =
                  emitidos === 0
                    ? "bg-cartao-3 text-fraco"
                    : emitidos === total
                      ? "bg-positivo-suave text-positivo"
                      : "bg-alerta-suave text-alerta";
                return (
                  <tr key={registro.id}>
                    <td className="mono text-[12px]">{registro.tituloOrigem}</td>
                    <td className="font-medium">{registro.clienteNome}</td>
                    <td className="mono text-center">{registro.quantidade}x</td>
                    <td className="num">{moeda(registro.valorTotal)}</td>
                    <td className="text-[12px]">
                      {POLITICA[registro.politicaOriginal] ?? registro.politicaOriginal}
                    </td>
                    <td>
                      <span className={`selo ${tom}`}>
                        {emitidos} de {total} emitidos
                      </span>
                    </td>
                    <td className="text-[12px]">{registro.usuario}</td>
                    <td className="mono text-[11.5px] text-suave">
                      {dataHoraBr(registro.criadoEm)}
                    </td>
                  </tr>
                );
              })}

              {parcelamentos.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <div className="mx-auto max-w-sm rounded-lg border border-dashed border-borda p-6">
                      <p className="text-[13.5px] font-semibold">Nenhum parcelamento ainda</p>
                      <p className="mt-1 text-[12.5px] text-fraco">
                        Selecione um título na tela Títulos e use a ação Parcelar.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </Pagina>
  );
}
