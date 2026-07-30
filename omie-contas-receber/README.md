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

## Clientes especiais: faixas e banco

Um contrato tem **zero ou mais faixas de desconto**. Cada faixa tem rótulo, percentual, categoria (`geral` / `secos` / `congelados`) e, se precisar, a praça (UF):

- **Uma faixa** → aplicada automaticamente (ex: Zaffari 10%).
- **Várias faixas** → o operador escolhe no modal de desconto, por título, com botões para aplicar a categoria ao lote inteiro (ex: PDA secos SP 23,01% / secos RJ 23% / congelados 15%; Mambo secos 9,5% / congelados 9%; Shibata secos 8% / congelados 5%). Sem faixa escolhida o sistema **bloqueia** o lançamento em vez de chutar o percentual.
- **Nenhuma faixa** → contrato só fixa o banco de cobrança (caso Smart Break). Tentar descontar devolve "contrato sem desconto — este cliente só tem banco definido".

O campo **banco do contrato** com "sempre mover o título para esta conta" faz o desconto já trocar a conta corrente do título, e a ação em lote **Aplicar banco do contrato** ajusta a conta de qualquer seleção sem tocar em valores — é o caminho para quem só precisa estar sempre no mesmo banco.

A carteira atual vive em [`src/dados/contratos-kalena.json`](src/dados/contratos-kalena.json). O botão **Importar lista de contratos** (tela Clientes especiais) compara o arquivo com o que já está cadastrado, casa cada linha com o cliente do Omie (por CNPJ, ou por nome ignorando Ltda/SA/Supermercado…) e com a conta corrente pelo nome do banco, e mostra o que será criado, atualizado ou está pendente — nada é gravado antes de você aplicar. Editar a lista no arquivo e reimportar é o jeito de propagar mudanças de percentual.

## Funcionalidades

- **Títulos a receber** com filtros (cliente/CNPJ/documento, período de vencimento, status, banco, saldo mínimo, somente clientes especiais, somente sem boleto), 4 indicadores no topo, seleção múltipla, paginação com 50/100/200 por página e barra de ações em lote.
- **Aplicar desconto de contrato** em lote, em três fases: pré-visualização (saldo atual, % de contrato, desconto e quanto restará, com totais), processamento item a item com contador e barra de progresso, e resultado com cartões de sucesso/aprovação/falha e **reprocessar somente as falhas**.
- **Desconto manual** para clientes sem contrato, com justificativa obrigatória. Acima do limite configurado vai para a **fila de aprovação do gestor** em vez de ser gravado.
- **Aprovações**: gestor aprova (grava no Omie na hora) ou rejeita, com histórico das decisões e contador no menu lateral. Operador acompanha o que enviou.
- **Trocar conta corrente do título** (o "mudar o banco"): altera apenas o `id_conta_corrente` via `AlterarContaReceber`. Não cancela nem reemite boleto — a tela avisa quais títulos já têm boleto e em qual banco.
- **Emitir boleto** individual ou em lote, sempre pela API do Omie, com linha digitável, link do PDF, "copiar linha", "baixar todos" e **tentar novamente** por linha que falhou.
- **Parcelar título**: 2 a 12 parcelas, data da primeira, intervalo, acréscimo opcional, prévia com o ajuste de arredondamento na primeira parcela, e política do título original — *baixar como parcelado* (recebimento de valor zero com desconto igual ao saldo) ou *excluir do Omie*. O original só é tocado se todas as parcelas entrarem.
- **Parcelamentos**: histórico com título de origem, parcelas, valor total, política aplicada e quantos boletos saíram.
- **Clientes especiais**: CRUD de contratos com percentual fixo, vigência, teto por título e conta preferencial; status Ativo/Expirado/Inativo, histórico de alterações do percentual e bloqueio de contratos vigentes sobrepostos.
- **Auditoria**: todo lançamento grava usuário, ação, payload enviado ao Omie e resposta. Linha expansível com antes → depois e o JSON enviado/recebido, filtros e exportação CSV.
- **Configurações**: status da conexão, credenciais mascaradas, contas correntes sincronizadas, conta padrão, piso de saldo, limite de desconto manual e lista de usuários/perfis.
- **Perfis**: operador (opera e solicita) e gestor (opera + contratos + configurações + fila de aprovação).
- **Tema claro/escuro** com preferência salva no navegador, tipografia IBM Plex Sans/Mono e números tabulares.

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

### Deploy (hospedar para testar)

Funciona direto na Vercel — `next build` sem passos extras. Antes do primeiro deploy:

1. Criar o projeto no Supabase e rodar `supabase/schema.sql`.
2. Configurar as variáveis de ambiente no projeto da Vercel: `OMIE_APP_KEY`, `OMIE_APP_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET` (`openssl rand -base64 32`), `ADMIN_USUARIO`, `ADMIN_SENHA`.
3. Entrar com o usuário administrador e cadastrar os clientes especiais.

Sem as variáveis do Omie o deploy sobe em modo demonstração — útil para o time navegar as telas antes de ligar no ERP. O `.data/store.json` **não** funciona em serverless: em produção o Supabase é obrigatório.

## Estrutura

```
src/
  app/
    (app)/titulos          tela principal (lista + ações em lote)
    (app)/clientes         contratos dos clientes especiais
    (app)/parcelamentos    histórico de parcelamentos
    (app)/aprovacoes       fila de desconto manual do gestor
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
