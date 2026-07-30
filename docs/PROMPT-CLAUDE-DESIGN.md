# Prompt para o Claude Design — Sistema de Contas a Receber integrado ao Omie

> Copie o bloco abaixo e cole no Claude Design.

---

Crie um sistema web de **gestão de Contas a Receber integrado ao ERP Omie**, em português do Brasil, para o time financeiro de uma distribuidora de alimentos (Kalena Foods). Stack: **Next.js (App Router) + TypeScript + Tailwind + shadcn/ui**, com **Supabase** (Postgres) para os dados próprios do sistema e **rotas de API server-side** para falar com o Omie. Nenhuma credencial do Omie pode aparecer no client.

## Objetivo

Substituir o trabalho manual dentro do Omie: hoje o operador abre título por título para dar desconto de contrato, emitir boleto, parcelar e trocar a conta bancária do título. O sistema deve fazer isso em lote, com um clique, e deixar rastro de auditoria.

## Usuários e permissões

- **Operador financeiro**: consulta títulos, emite boleto, aplica desconto de contrato (dentro do % cadastrado), parcela.
- **Gestor**: tudo do operador + cadastra/edita clientes especiais e percentuais de contrato + aprova desconto manual acima do limite + vê auditoria.
- Login por e-mail/senha (Supabase Auth). Tela de login simples, com a marca no topo.

## Integração Omie (server-side)

Autenticação por `app_key` + `app_secret` guardados em variáveis de ambiente. Todas as chamadas passam por rotas internas (`/api/omie/...`) com tratamento de erro, retry e cache curto. Endpoints usados (confirmar nomes na documentação oficial do Omie antes de codar):

- Clientes: `geral/clientes` → `ListarClientes`
- Contas a receber: `financas/contareceber` → `ListarContasReceber`, `AlterarContaReceber`, `IncluirContaReceber`, `ExcluirContaReceber`
- Boleto: `financas/contareceberboleto` → `EmitirBoleto`, `ObterBoleto` (retorna link/PDF gerado pelo Omie)
- Contas correntes: `geral/contacorrente` → `ListarContasCorrentes`

Regras de integração:
- **O desconto é lançado pela tela "Registrar Recebimento" do Omie, no campo Desconto, com Valor do Recebimento = 0** (`LancarRecebimento` com `valor: 0`, `desconto: <valor>`, `juros: 0`, `multa: 0`, mais a conta corrente e a data). O título **não é quitado**: o saldo cai apenas o valor do desconto e o restante continua a receber. Ex.: título de R$ 2.101,00 com desconto de R$ 100,00 fica com R$ 2.001,00 em aberto ("Restará R$ 2.001,00 a receber da conta").
- O boleto é **sempre gerado pela API do Omie** — o sistema nunca desenha boleto próprio; só exibe/baixa o PDF ou link que o Omie devolve.
- **Trocar banco = apenas alterar a conta corrente do título** (`id_conta_corrente`) via `AlterarContaReceber`. Não cancela nem reemite boleto. Se o título já tiver boleto emitido, mostrar aviso claro: "este título já possui boleto emitido no banco X — trocar a conta não invalida o boleto existente".
- O valor do desconto é sempre recalculado no servidor a partir do percentual do contrato cadastrado; o número que veio da tela nunca é aceito como verdade para clientes com contrato.
- Toda escrita no Omie é registrada no log de auditoria com payload enviado e resposta recebida.

## Telas

### 1. Dashboard / Lista de títulos (tela principal)

Tabela densa, paginada, com seleção múltipla por checkbox. Colunas: cliente (nome + CNPJ), nº do documento/NF, parcela, emissão, vencimento, valor original, desconto aplicado, valor líquido, conta corrente/banco, status (Aberto, Vencido, Pago, Parcialmente pago, Cancelado), boleto (badge: emitido / não emitido, com ícone de download).

- Filtros no topo: cliente, período de vencimento, status, banco/conta corrente, "somente clientes especiais", faixa de valor.
- Cards de resumo acima da tabela: total a receber, total vencido, total de descontos do mês, títulos sem boleto.
- Linhas de cliente especial recebem um selo discreto ("Contrato −4,5%").
- Barra de ações em lote que aparece quando há seleção: **Aplicar desconto de contrato**, **Emitir boleto**, **Trocar conta bancária**, **Parcelar** (parcelar só habilita com 1 título selecionado).

### 2. Botão "Aplicar desconto de contrato" (o fluxo central do produto)

Ao clicar, abre um modal de **pré-visualização antes de gravar nada**:

- Tabela com uma linha por título: cliente, saldo atual, % de contrato do cliente, valor do desconto calculado e quanto **restará** a receber depois do lançamento.
- Títulos de clientes sem contrato cadastrado aparecem em seção separada "sem desconto de contrato", desmarcados, com opção de aplicar desconto manual com justificativa obrigatória.
- Campo opcional "trocar conta corrente destes títulos para:" com select de contas correntes do Omie — aplicado na mesma operação.
- Totais no rodapé do modal: soma dos valores originais, soma dos descontos, soma líquida.
- Botão **Confirmar e gravar no Omie**. Durante o processamento, mostrar progresso item a item (ex: "12 de 30"), e no fim um resumo com sucessos e falhas, permitindo reprocessar só as falhas.
- Arredondamento em 2 casas, sempre para baixo no centavo, e o desconto nunca pode deixar o valor líquido negativo ou abaixo de um piso configurável.

### 3. Clientes especiais (descontos de contrato)

CRUD em tabela: cliente (busca com autocomplete puxando do Omie), CNPJ, grupo/rede, **faixas de desconto**, vigência (início/fim), teto de desconto em R$ por título (opcional), banco/conta corrente do contrato com a opção "sempre mover o título para esta conta", ativo/inativo, observações.

- **Faixas**: cada contrato tem zero ou mais faixas, com rótulo, percentual, categoria (geral/secos/congelados) e praça (UF). Uma faixa é aplicada automaticamente; com várias, o operador escolhe no modal de desconto e o sistema bloqueia o lançamento até a escolha; com nenhuma, o contrato só fixa o banco de cobrança.
- Validação: percentual entre 0 e 100, com 2 decimais; não permitir dois contratos vigentes sobrepostos para o mesmo cliente; contrato sem faixa exige conta corrente.
- Histórico de alterações visível no detalhe do cliente (quem mudou, quando, de quanto para quanto).
- Importação da lista de clientes especiais com prévia: casa cada linha com o cliente do Omie e com a conta corrente pelo nome do banco, e mostra o que será criado, atualizado ou está pendente.

### 4. Parcelamento de boleto

A partir de um título: informar número de parcelas (2 a 12), data da primeira parcela e intervalo em dias (ou datas customizadas por parcela). Mostrar prévia das parcelas com valor de cada uma — a diferença de arredondamento vai na primeira parcela. Permitir aplicar juros/acréscimo opcional por parcela. Ao confirmar: cria os novos títulos no Omie, baixa/cancela o título original conforme a política escolhida, e opcionalmente emite os boletos de todas as parcelas em sequência, mostrando o resultado de cada um.

### 5. Emissão de boleto

Ação individual e em lote. Ao concluir, exibir lista com link/PDF de cada boleto, botão para baixar todos e botão para copiar a linha digitável. Falhas por título aparecem com a mensagem de erro do Omie, não um erro genérico.

### 6. Auditoria

Tabela de eventos filtrável por usuário, tipo de ação (desconto, boleto, parcelamento, troca de conta), cliente e período. Cada linha expande mostrando o antes/depois e o payload enviado ao Omie. Somente leitura, com exportação CSV.

### 7. Configurações

Status da conexão com o Omie (botão "testar conexão"), lista de contas correntes sincronizadas, conta corrente padrão, piso de valor líquido, limite de desconto manual que exige aprovação do gestor, usuários e perfis.

## Modelo de dados (Supabase)

- `clientes_contrato`: id, omie_cliente_id, cnpj, nome, percentual_desconto, vigencia_inicio, vigencia_fim, teto_desconto, conta_corrente_preferencial, ativo, timestamps.
- `descontos_aplicados`: id, omie_titulo_id, cliente_id, valor_original, percentual, valor_desconto, valor_liquido, tipo (contrato | manual), justificativa, usuario_id, conta_corrente_anterior, conta_corrente_nova, status, created_at.
- `parcelamentos`: id, omie_titulo_origem, qtd_parcelas, titulos_gerados (jsonb), usuario_id, created_at.
- `auditoria`: id, usuario_id, acao, entidade, payload_enviado (jsonb), resposta_omie (jsonb), sucesso, erro, created_at.
- `config`: chave/valor.

## Requisitos visuais

- Layout com sidebar fixa à esquerda (Títulos, Clientes especiais, Parcelamentos, Auditoria, Configurações) e conteúdo à direita.
- Estética profissional de ferramenta financeira: densa mas respirável, tipografia tabular para números, alinhamento de valores à direita, tons neutros com um azul de ação. Suporte a tema claro e escuro.
- Todos os valores em R$ com separador de milhar e 2 decimais; datas em dd/mm/aaaa.
- Estados vazios, skeletons de carregamento e toasts de sucesso/erro em toda ação.
- Responsivo: em tela pequena a tabela vira cards, e as ações em lote ficam num botão flutuante.

## Não fazer

- Não inventar dados do Omie como se fossem reais: use mocks claramente identificados quando a API não estiver configurada, e mostre um banner "modo demonstração".
- Não gravar nada no Omie sem a tela de pré-visualização e confirmação.
- Não expor `app_key`/`app_secret` no front-end.
- Não recriar boleto próprio nem cancelar/reemitir boleto ao trocar a conta corrente.
