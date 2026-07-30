-- Schema do sistema de contas a receber integrado ao Omie.
-- Rode no SQL Editor do Supabase.

-- Um contrato pode ter várias faixas de desconto (secos/congelados, SP/RJ) ou
-- nenhuma — caso do cliente que só precisa ser cobrado sempre no mesmo banco.
-- Cada item de `regras`: {id, rotulo, percentual, categoria, uf, padrao}.
create table if not exists contratos (
  id uuid primary key,
  omie_cliente_id bigint not null,
  nome text not null,
  cnpj text not null default '',
  grupo text,
  regras jsonb not null default '[]'::jsonb,
  vigencia_inicio date,
  vigencia_fim date,
  teto_desconto numeric(14, 2),
  conta_corrente_preferencial bigint,
  aplicar_conta_sempre boolean not null default true,
  ativo boolean not null default true,
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists contratos_cliente_idx on contratos (omie_cliente_id);

create table if not exists auditoria (
  id uuid primary key,
  usuario text not null,
  acao text not null,
  entidade text not null,
  descricao text not null,
  payload_enviado jsonb,
  resposta_omie jsonb,
  sucesso boolean not null,
  erro text,
  criado_em timestamptz not null default now()
);

create index if not exists auditoria_criado_em_idx on auditoria (criado_em desc);
create index if not exists auditoria_acao_idx on auditoria (acao);
create index if not exists auditoria_entidade_idx on auditoria (entidade);

-- Fila de aprovação: desconto manual acima do limite espera decisão do gestor.
create table if not exists aprovacoes (
  id uuid primary key,
  titulo_id bigint not null,
  cliente_id bigint not null,
  cliente_nome text not null,
  documento text not null default '',
  saldo numeric(14, 2) not null,
  percentual numeric(6, 2) not null,
  valor_desconto numeric(14, 2) not null,
  saldo_final numeric(14, 2) not null,
  justificativa text not null,
  solicitante text not null,
  conta_corrente_id bigint,
  data date not null,
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'rejeitado')),
  criado_em timestamptz not null default now(),
  decidido_em timestamptz,
  decisor text,
  observacao_decisao text
);

create index if not exists aprovacoes_status_idx on aprovacoes (status, criado_em desc);

create table if not exists parcelamentos (
  id uuid primary key,
  titulo_origem bigint not null,
  cliente_nome text not null,
  quantidade int not null,
  valor_total numeric(14, 2) not null,
  politica_original text not null check (politica_original in ('baixado', 'excluido')),
  titulos_gerados jsonb not null default '[]'::jsonb,
  boletos_emitidos int not null default 0,
  usuario text not null,
  criado_em timestamptz not null default now()
);

create index if not exists parcelamentos_criado_em_idx on parcelamentos (criado_em desc);

create table if not exists config (
  chave text primary key,
  valor jsonb
);

create table if not exists usuarios (
  usuario text primary key,
  nome text not null,
  perfil text not null check (perfil in ('operador', 'gestor')),
  senha_hash text not null,
  criado_em timestamptz not null default now()
);

-- O app acessa o banco pelo service role key no servidor, então mantemos RLS
-- habilitado sem policies públicas: nenhum acesso direto pelo client.
alter table contratos enable row level security;
alter table auditoria enable row level security;
alter table aprovacoes enable row level security;
alter table parcelamentos enable row level security;
alter table config enable row level security;
alter table usuarios enable row level security;
