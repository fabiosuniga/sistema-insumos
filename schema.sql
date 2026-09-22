
create extension if not exists pgcrypto;

-- ============================================================
-- TIPO ENUM DE PAPEIS (RBAC)
-- ============================================================
create type public.app_role as enum ('colaborador', 'gestor');

-- ============================================================
-- profiles (perfil de usuário, 1:1 com auth.users)
-- ============================================================
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  role        public.app_role not null default 'colaborador',
  created_at  timestamptz not null default now()
);

-- Auto-cria o profile quando um usuário se registra 
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
          'colaborador');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Verifica se o usuário é gestor
-- ============================================================
create or replace function public.is_gestor()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'gestor'
  );
$$;

-- ============================================================
-- items (catálogo de insumos)
-- ============================================================
create table public.items (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  category      text not null check (category in ('Papelaria', 'Informática', 'Limpeza', 'Outros')),
  unit          text not null default 'un' check (unit in ('un', 'cx', 'resma', 'kit')),
  stock         integer not null default 0 check (stock >= 0),
  min_stock     integer not null default 0 check (min_stock >= 0),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- requests (solicitações)
-- ============================================================
create table public.requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  item_id      uuid not null references public.items(id) on delete restrict,
  quantity     integer not null check (quantity > 0),
  status       text not null default 'pendente'
               check (status in ('pendente', 'aprovado', 'entregue', 'cancelado')),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Índices de performance
create index requests_user_idx on public.requests (user_id);
create index requests_item_idx on public.requests (item_id);
create index requests_status_idx on public.requests (status);

-- ============================================================
-- RN-01 — BLOQUEIO DE SOLICITAÇÃO DUPLICADA
--    Um colaborador não pode ter 2+ pedidos "pendente" do MESMO item.
-- ============================================================
create unique index requests_no_duplicate_pending
  on public.requests (user_id, item_id)
  where status = 'pendente';

-- ============================================================
-- audit_logs
-- ============================================================
create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles(id) on delete set null,
  action      text not null,           -- ex.: 'request.created', 'request.delivered', 'item.adjusted'
  entity      text not null,           -- 'request' | 'item'
  entity_id   uuid,
  detail      jsonb not null default '{}'::jsonb,  -- {item_name, quantity, old_stock, new_stock, ...}
  created_at  timestamptz not null default now()
);

create index audit_logs_actor_idx on public.audit_logs (actor_id);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

-- ============================================================
--  entrega decrementa estoque automaticamente
-- ============================================================
create or replace function public.handle_request_update()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_item_name text;
  v_old_stock int;
begin
  -- baixa no estoque quando for entregue
  if new.status = 'entregue' and old.status is distinct from 'entregue' then
    select name, stock into v_item_name, v_old_stock
      from public.items where id = new.item_id for update;

    -- impede o estoque negativo
    if v_old_stock < new.quantity then
      raise exception 'Estoque insuficiente para "%": disponível %, solicitado %.',
        v_item_name, v_old_stock, new.quantity
        using errcode = 'P0001';
    end if;

    update public.items set stock = stock - new.quantity, updated_at = now()
      where id = new.item_id;

    -- log da baixa
    insert into public.audit_logs (actor_id, action, entity, entity_id, detail)
    values (auth.uid(), 'request.delivered', 'request', new.id,
            jsonb_build_object('item_id', new.item_id, 'item_name', v_item_name,
                               'quantity', new.quantity,
                               'old_stock', v_old_stock,
                               'new_stock', v_old_stock - new.quantity,
                               'requested_by', new.user_id));
  end if;

  -- Log das demais mudanças de status
  if new.status <> old.status and new.status <> 'entregue' then
    insert into public.audit_logs (actor_id, action, entity, entity_id, detail)
    values (auth.uid(), 'request.' || new.status, 'request', new.id,
            jsonb_build_object('from_status', old.status, 'to_status', new.status,
                               'requested_by', new.user_id));
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_request_update
  before update on public.requests
  for each row execute function public.handle_request_update();

-- Trigger de log na criação de solicitação
create or replace function public.handle_request_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.audit_logs (actor_id, action, entity, entity_id, detail)
  values (new.user_id, 'request.created', 'request', new.id,
          jsonb_build_object('item_id', new.item_id, 'quantity', new.quantity));
  return new;
end;
$$;

create trigger trg_request_insert
  after insert on public.requests
  for each row execute function public.handle_request_insert();

-- Trigger de log em mudanças de itens
create or replace function public.handle_item_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.audit_logs (actor_id, action, entity, entity_id, detail)
  values (auth.uid(),
          case when tg_op = 'INSERT' then 'item.created'
               when tg_op = 'DELETE' then 'item.deleted'
               else 'item.updated' end,
          'item', coalesce(new.id, old.id),
          jsonb_build_object('name', coalesce(new.name, old.name),
                             'old_stock', old.stock, 'new_stock', new.stock));
  return coalesce(new, old);
end;
$$;

create trigger trg_item_change
  before insert or update or delete on public.items
  for each row execute function public.handle_item_change();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table public.profiles   enable row level security;
alter table public.items      enable row level security;
alter table public.requests   enable row level security;
alter table public.audit_logs enable row level security;

-- ===============================
-- ---------- profiles ----------
-- ==============================

-- Todo usuário autenticado lê os perfis (necessário p/ mostrar nomes)
create policy profiles_select on public.profiles
  for select to authenticated using (true);

-- Cada um edita apenas o próprio perfil
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

-- ==============================
-- ---------- items ----------
-- ==============================

-- Colaborador: SOMENTE LEITURA de itens ativos
create policy items_select_active on public.items
  for select to authenticated using (is_gestor() or is_active = true);

-- Gestor: CRUD completo de itens
create policy items_insert_gestor on public.items
  for insert to authenticated with check (is_gestor());
create policy items_update_gestor on public.items
  for update to authenticated using (is_gestor()) with check (is_gestor());
create policy items_delete_gestor on public.items
  for delete to authenticated using (is_gestor());

-- =================================================
-- ---------- requests (REGRA CENTRAL) ----------
-- ==================================================

-- SELECT: colaborador vê SÓ os próprios pedidos; gestor vê tudo
create policy requests_select on public.requests
  for select to authenticated
  using (user_id = auth.uid() or is_gestor());

-- INSERT: o colaborador cria pedido SÓ em seu próprio nome
create policy requests_insert_own on public.requests
  for insert to authenticated
  with check (user_id = auth.uid());

-- UPDATE/CANCEL: colaborador cancela os PRÓPRIOS pedidos; gestor edita tudo
create policy requests_update on public.requests
  for update to authenticated
  using (is_gestor() or (user_id = auth.uid() and status = 'pendente'))
  with check (is_gestor() or (user_id = auth.uid() and status = 'cancelado'));

-- DELETE: ninguém apaga pedidos (histórico preservado); gestor "desativa" via status

-- ==============================
-- ---------- audit_logs ----------
-- ==============================

-- SOMENTE o gestor lê os logs
create policy audit_logs_select_gestor on public.audit_logs
  for select to authenticated using (is_gestor());

-- Escrita em logs só acontece via SECURITY DEFINER triggers
create policy audit_logs_insert_trigger on public.audit_logs
  for insert to authenticated with check (actor_id = auth.uid() or is_gestor());

-- ============================================================
--                          DADOS INICIAIS
-- ============================================================
insert into public.items (name, category, unit, stock, min_stock) values
  ('Resma de Papel A4 75g',        'Papelaria',   'resma', 120, 30),
  ('Toner HP 85A Preto',           'Informática', 'un',     15,  5),
  ('Mouse Óptico USB',             'Informática', 'un',     40, 10),
  ('Teclado ABNT2 USB',            'Informática', 'un',     35, 10),
  ('Caneta Esferográfica Azul',    'Papelaria',   'cx',     60, 20),
  ('Pano Multiuso (pacote 10un)',  'Limpeza',     'kit',    25,  8);

-- ============================================================
-- Promovendo o primeiro gestor do sistema
-- ============================================================
-- update public.profiles set role = 'gestor'
-- where id = (select id from auth.users where email = 'fabiosuniga@hotmail.com');
