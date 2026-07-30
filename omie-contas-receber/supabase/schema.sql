-- Schema do sistema de contas a receber integrado ao Omie.
-- Rode no SQL Editor do Supabase.

create table if not exists contratos (
  id uuid primary key,
  omie_cliente_id bigint not null,
  nome text not null,
  cnpj text not null default '',
  percentual_desconto numeric(5, 2) not null check (percentual_desconto > 0 and percentual_desconto <= 100),
  vigencia_inicio date,
  vigencia_fim date,
  teto_desconto numeric(14, 2),
  conta_corrente_preferencial bigint,
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
alter table config enable row level security;
alter table usuarios enable row level security;
