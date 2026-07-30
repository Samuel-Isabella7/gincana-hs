# Contas a Receber — integrado ao Omie

Sistema web para o time financeiro operar o contas a receber do Omie sem abrir título por título: aplicar desconto de contrato em lote, emitir boleto, parcelar e trocar a conta corrente do título, com trilha de auditoria de tudo que foi enviado ao ERP.

Stack: Next.js 16 (App Router) + TypeScript + Tailwind 4, Supabase (Postgres) para os dados próprios e rotas de API server-side para falar com o Omie. Nenhuma credencial do Omie chega ao navegador.

## Como o desconto é lançado

O desconto vai na aba **Desconto** da tela *Registrar Recebimento* do Omie, com **Valor do Recebimento = 0**:

| Campo               | Valor enviado          |
| ------------------- | ---------------------- |
| Conta Corrente      | conta escolhida na tela |
| Valor do Recebimento| `0`                    |
| Desconto            | valor calculado         |
| Juros / Multa       | `0`                    |

Efeito: o título **não é quitado**. O saldo cai apenas o valor do desconto e o restante continua a receber — exatamente o comportamento de "Restará R$ X a receber da conta". Ex.: título de R$ 2.101,00 com desconto de R$ 100,00 fica com R$ 2.001,00 em aberto.

O cálculo é sempre refeito no servidor a partir do percentual do contrato cadastrado; o valor que vem da tela nunca é aceito como verdade para clientes com contrato.

## Funcionalidades

- **Lista de títulos** com filtros (cliente/CNPJ/documento, status, banco, período de vencimento, somente clientes especiais, somente sem boleto), indicadores de total a receber / vencido / descontos / sem boleto e seleção múltipla.
- **Aplicar desconto de contrato** em lote, com pré-visualização antes de gravar: saldo atual, percentual, desconto e quanto restará por título, mais totais. Processa item a item mostrando progresso e devolve sucessos/falhas com a mensagem do Omie.
- **Desconto manual** para clientes sem contrato, com justificativa obrigatória e limite de valor que exige perfil gestor.
- **Trocar conta corrente do título** (o "mudar o banco"): altera apenas o `id_conta_corrente` do título via `AlterarContaReceber`. Não cancela nem reemite boleto — a tela avisa quando o título já tem boleto emitido.
- **Emitir boleto** individual ou em lote, sempre pela API do Omie, com link/PDF e linha digitável no resultado.
- **Parcelar título**: 2 a 12 parcelas, data da primeira, intervalo em dias, acréscimo opcional; a diferença de arredondamento fica na primeira parcela. Cria as parcelas no Omie, opcionalmente emite os boletos e só exclui o título original se todas as parcelas forem criadas.
- **Clientes especiais**: CRUD de contratos com percentual fixo, vigência, teto por título e conta corrente preferencial. Bloqueia contratos ativos sobrepostos para o mesmo cliente.
- **Auditoria**: todo lançamento grava usuário, ação, payload enviado ao Omie, resposta, sucesso/erro. Filtros e exportação CSV.
- **Perfis**: operador (opera) e gestor (opera + cadastra contratos, altera configurações, aprova desconto manual acima do limite).

## Como rodar

```bash
npm install
cp .env.example .env.local   # preencha as variáveis
npm run dev                  # http://localhost:3000
```

Sem `OMIE_APP_KEY` / `OMIE_APP_SECRET` o sistema entra em **modo demonstração**: dados fictícios em memória, banner de aviso e nenhuma chamada ao Omie. Serve para navegar as telas e treinar a equipe.

Sem `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`, contratos/auditoria/config/usuários vão para `.data/store.json` (apenas desenvolvimento — em produção use o Supabase).

O primeiro acesso cria o usuário de `ADMIN_USUARIO` / `ADMIN_SENHA` com perfil gestor. Troque a senha depois de entrar.

### Supabase

Rode `supabase/schema.sql` no SQL Editor do projeto. As tabelas ficam com RLS habilitado e sem policies públicas: o acesso é só server-side, com a service role key.

### Deploy

Funciona direto na Vercel. Configure as mesmas variáveis de ambiente do `.env.example` no projeto (o `.data/store.json` não é utilizável em serverless — o Supabase é obrigatório em produção).

## Estrutura

```
src/
  app/
    (app)/titulos          tela principal (lista + ações em lote)
    (app)/clientes         contratos dos clientes especiais
    (app)/auditoria        trilha de eventos
    (app)/configuracoes    conexão, contas correntes e limites
    login                  autenticação
    api/                   rotas server-side (descontos, boletos, parcelamentos, ...)
  components/              telas e modais
  lib/
    omie/client.ts         HTTP do Omie: fila, retry, tratamento de faultstring
    omie/service.ts        métodos da API Omie usados pelo sistema
    omie/mock.ts           dados do modo demonstração
    desconto.ts            cálculo do desconto (teto, piso, bloqueios)
    parcelamento.ts        divisão em parcelas
    operacoes.ts           orquestração + auditoria de cada operação
    store.ts               Supabase / arquivo local
    auth.ts                sessão em cookie assinado
```

## Métodos da API Omie usados

Todos concentrados em `src/lib/omie/service.ts` — se algum campo mudar na documentação, é o único arquivo a ajustar.

| Recurso                       | Métodos                                                                                            |
| ----------------------------- | -------------------------------------------------------------------------------------------------- |
| `financas/contareceber`       | `ListarContasReceber`, `ConsultarContaReceber`, `LancarRecebimento`, `AlterarContaReceber`, `IncluirContaReceber`, `ExcluirContaReceber` |
| `financas/contareceberboleto` | `EmitirBoleto`, `ObterBoleto`                                                                      |
| `geral/contacorrente`         | `ListarContasCorrentes`                                                                            |
| `geral/clientes`              | `ListarClientesResumido`                                                                           |

Notas de integração:

- As chamadas são serializadas com intervalo mínimo entre requisições (o Omie limita chamadas simultâneas por `app_key`) e repetem em falha temporária.
- `ListarContasReceber` não traz dados de boleto. Para exibir a coluna de boleto preenchida em produção, ative `OMIE_BUSCAR_BOLETOS=1` — cuidado: é uma chamada `ObterBoleto` por título da página.
- Erros de negócio do Omie chegam como `faultstring` e são repassados na íntegra para a tela, sem mensagem genérica.

## Verificações

```bash
npm run lint
npx tsc --noEmit
npm run build
```
