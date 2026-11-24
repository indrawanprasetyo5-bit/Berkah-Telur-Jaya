-- Berkah Telur Jaya: tabel, trigger stok, dan RLS.
-- Jalankan di Supabase SQL Editor atau via Supabase CLI.

create extension if not exists pgcrypto;

-- Schema privat supaya fungsi internal tidak terekspos lewat PostgREST.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- Tabel

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'staff' check (role in ('owner', 'staff')),
  whatsapp_number text,
  created_at timestamptz not null default now()
);

create table if not exists public.egg_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  price_per_kg numeric(12, 2) not null check (price_per_kg >= 0),
  cost_per_kg numeric(12, 2) not null check (cost_per_kg >= 0),
  stock_kg numeric(10, 2) not null default 0 check (stock_kg >= 0),
  min_stock_kg numeric(10, 2) not null default 15 check (min_stock_kg >= 0),
  kg_per_peti numeric(6, 2) not null default 15 check (kg_per_peti > 0),
  distributor_wa text,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Untuk database lama yang tabelnya dibuat sebelum constraint ini ada.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.egg_types'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%stock_kg >= 0%'
  ) then
    alter table public.egg_types
      add constraint egg_types_stock_kg_non_negative check (stock_kg >= 0);
  end if;
end $$;

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  cashier_id uuid not null references public.profiles(id) on delete restrict,
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  total_cost numeric(12, 2) not null check (total_cost >= 0),
  payment_method text not null check (payment_method in ('cash', 'qris', 'transfer')),
  cash_received numeric(12, 2) not null default 0 check (cash_received >= 0),
  change_amount numeric(12, 2) not null default 0 check (change_amount >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  egg_type_id uuid not null references public.egg_types(id) on delete restrict,
  qty_kg numeric(10, 2) not null check (qty_kg > 0),
  unit_label text not null,
  is_cracked boolean not null default false,
  price_per_kg numeric(12, 2) not null check (price_per_kg >= 0),
  cost_per_kg numeric(12, 2) not null check (cost_per_kg >= 0),
  subtotal numeric(12, 2) not null check (subtotal >= 0)
);

create table if not exists public.restock_deliveries (
  id uuid primary key default gen_random_uuid(),
  egg_type_id uuid not null references public.egg_types(id) on delete restrict,
  peti_count numeric(8, 2) not null default 0 check (peti_count >= 0),
  qty_kg numeric(10, 2) not null check (qty_kg > 0),
  cost_per_kg numeric(12, 2) not null check (cost_per_kg >= 0),
  supplier_name text not null,
  driver_name text,
  broken_kg numeric(10, 2) not null default 0 check (broken_kg >= 0),
  notes text,
  received_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint restock_broken_lte_qty check (broken_kg <= qty_kg)
);

create table if not exists public.stock_losses (
  id uuid primary key default gen_random_uuid(),
  egg_type_id uuid not null references public.egg_types(id) on delete restrict,
  qty_kg numeric(10, 2) not null check (qty_kg > 0),
  cost_loss numeric(12, 2) not null check (cost_loss >= 0),
  reason text not null check (reason in ('pecah_lapak', 'busuk', 'lainnya')),
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  amount numeric(12, 2) not null check (amount > 0),
  category text not null check (category in ('plastik', 'parkir', 'konsumsi', 'lainnya')),
  notes text,
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_closings (
  id uuid primary key default gen_random_uuid(),
  closing_date date not null unique,
  expected_cash numeric(12, 2) not null default 0,
  actual_cash numeric(12, 2) not null default 0,
  total_expenses numeric(12, 2) not null default 0,
  qris_total numeric(12, 2) not null default 0,
  transfer_total numeric(12, 2) not null default 0,
  total_revenue numeric(12, 2) not null default 0,
  total_profit numeric(12, 2) not null default 0,
  notes text,
  closed_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

-- Indeks

create index if not exists idx_sales_created_at on public.sales (created_at desc);
create index if not exists idx_sales_cashier_id on public.sales (cashier_id);
create index if not exists idx_sale_items_sale_id on public.sale_items (sale_id);
create index if not exists idx_sale_items_egg_type_id on public.sale_items (egg_type_id);
create index if not exists idx_restock_created_at on public.restock_deliveries (created_at desc);
create index if not exists idx_restock_egg_type_id on public.restock_deliveries (egg_type_id);
create index if not exists idx_restock_received_by on public.restock_deliveries (received_by);
create index if not exists idx_stock_losses_created_at on public.stock_losses (created_at desc);
create index if not exists idx_stock_losses_egg_type_id on public.stock_losses (egg_type_id);
create index if not exists idx_stock_losses_recorded_by on public.stock_losses (recorded_by);
create index if not exists idx_expenses_created_at on public.expenses (created_at desc);
create index if not exists idx_expenses_recorded_by on public.expenses (recorded_by);
create index if not exists idx_daily_closings_date on public.daily_closings (closing_date desc);
create index if not exists idx_daily_closings_closed_by on public.daily_closings (closed_by);

-- Fungsi & trigger

-- Role dibaca dari profiles, bukan user_metadata yang bisa diubah user sendiri.
create or replace function private.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'owner'
    );
$$;

create or replace function private.is_staff_or_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role in ('owner', 'staff')
    );
$$;

revoke all on function private.is_owner() from public;
revoke all on function private.is_staff_or_owner() from public;
grant execute on function private.is_owner() to authenticated;
grant execute on function private.is_staff_or_owner() to authenticated;

-- User baru otomatis dapat profil dengan role staff.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    'staff'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_egg_types_updated_at on public.egg_types;
create trigger trg_egg_types_updated_at
  before update on public.egg_types
  for each row execute function private.set_updated_at();

-- FOR UPDATE mencegah dua kasir menjual stok yang sama bersamaan.
create or replace function private.adjust_stock_on_sale_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_stock numeric(10, 2);
  v_egg_name text;
begin
  if tg_op = 'INSERT' then
    select stock_kg, name
    into v_current_stock, v_egg_name
    from public.egg_types
    where id = new.egg_type_id
    for update;

    if v_current_stock is null then
      raise exception 'Jenis telur tidak ditemukan.';
    end if;

    if v_current_stock < new.qty_kg then
      raise exception 'Stok % tidak mencukupi (tersisa % kg, dibutuhkan % kg).',
        v_egg_name, v_current_stock, new.qty_kg;
    end if;

    update public.egg_types
    set stock_kg = v_current_stock - new.qty_kg
    where id = new.egg_type_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.egg_types
    set stock_kg = stock_kg + old.qty_kg
    where id = old.egg_type_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_sale_items_stock on public.sale_items;
create trigger trg_sale_items_stock
  after insert or delete on public.sale_items
  for each row execute function private.adjust_stock_on_sale_item();

-- Restock ikut memperbarui harga modal ke harga kiriman terbaru.
create or replace function private.adjust_stock_on_restock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  net_kg numeric(10, 2);
begin
  if tg_op = 'INSERT' then
    net_kg := greatest(0, new.qty_kg - new.broken_kg);
    update public.egg_types
    set stock_kg = stock_kg + net_kg,
        cost_per_kg = new.cost_per_kg
    where id = new.egg_type_id;
    return new;
  elsif tg_op = 'DELETE' then
    net_kg := greatest(0, old.qty_kg - old.broken_kg);
    update public.egg_types
    set stock_kg = greatest(0, stock_kg - net_kg)
    where id = old.egg_type_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_restock_stock on public.restock_deliveries;
create trigger trg_restock_stock
  after insert or delete on public.restock_deliveries
  for each row execute function private.adjust_stock_on_restock();

create or replace function private.adjust_stock_on_loss()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_stock numeric(10, 2);
  v_egg_name text;
begin
  if tg_op = 'INSERT' then
    select stock_kg, name
    into v_current_stock, v_egg_name
    from public.egg_types
    where id = new.egg_type_id
    for update;

    if v_current_stock is null then
      raise exception 'Jenis telur tidak ditemukan.';
    end if;

    if v_current_stock < new.qty_kg then
      raise exception 'Jumlah telur pecah/busuk melebihi sisa stok % (% kg).',
        v_egg_name, v_current_stock;
    end if;

    update public.egg_types
    set stock_kg = v_current_stock - new.qty_kg
    where id = new.egg_type_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.egg_types
    set stock_kg = stock_kg + old.qty_kg
    where id = old.egg_type_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_stock_losses_stock on public.stock_losses;
create trigger trg_stock_losses_stock
  after insert or delete on public.stock_losses
  for each row execute function private.adjust_stock_on_loss();

-- RLS

alter table public.profiles enable row level security;
alter table public.egg_types enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.restock_deliveries enable row level security;
alter table public.stock_losses enable row level security;
alter table public.expenses enable row level security;
alter table public.daily_closings enable row level security;

-- profiles
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (private.is_staff_or_owner());

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and role = (select p.role from public.profiles p where p.id = (select auth.uid()))
  );

drop policy if exists "profiles_manage_owner" on public.profiles;
create policy "profiles_manage_owner"
  on public.profiles for all
  to authenticated
  using (private.is_owner())
  with check (private.is_owner());

-- egg_types: staff hanya baca, stok berubah lewat trigger
drop policy if exists "egg_types_select_team" on public.egg_types;
create policy "egg_types_select_team"
  on public.egg_types for select
  to authenticated
  using (private.is_staff_or_owner());

drop policy if exists "egg_types_insert_owner" on public.egg_types;
create policy "egg_types_insert_owner"
  on public.egg_types for insert
  to authenticated
  with check (private.is_owner());

drop policy if exists "egg_types_update_owner" on public.egg_types;
create policy "egg_types_update_owner"
  on public.egg_types for update
  to authenticated
  using (private.is_owner())
  with check (private.is_owner());

drop policy if exists "egg_types_delete_owner" on public.egg_types;
create policy "egg_types_delete_owner"
  on public.egg_types for delete
  to authenticated
  using (private.is_owner());

-- sales
drop policy if exists "sales_select_team" on public.sales;
create policy "sales_select_team"
  on public.sales for select
  to authenticated
  using (private.is_staff_or_owner());

drop policy if exists "sales_insert_team" on public.sales;
create policy "sales_insert_team"
  on public.sales for insert
  to authenticated
  with check (
    private.is_staff_or_owner()
    and (cashier_id = (select auth.uid()) or private.is_owner())
  );

drop policy if exists "sales_update_owner" on public.sales;
create policy "sales_update_owner"
  on public.sales for update
  to authenticated
  using (private.is_owner())
  with check (private.is_owner());

drop policy if exists "sales_delete_owner" on public.sales;
create policy "sales_delete_owner"
  on public.sales for delete
  to authenticated
  using (private.is_owner());

-- sale_items
drop policy if exists "sale_items_select_team" on public.sale_items;
create policy "sale_items_select_team"
  on public.sale_items for select
  to authenticated
  using (private.is_staff_or_owner());

drop policy if exists "sale_items_insert_team" on public.sale_items;
create policy "sale_items_insert_team"
  on public.sale_items for insert
  to authenticated
  with check (
    private.is_staff_or_owner()
    and exists (
      select 1
      from public.sales s
      where s.id = sale_id
        and (s.cashier_id = (select auth.uid()) or private.is_owner())
    )
  );

drop policy if exists "sale_items_update_owner" on public.sale_items;
create policy "sale_items_update_owner"
  on public.sale_items for update
  to authenticated
  using (private.is_owner())
  with check (private.is_owner());

drop policy if exists "sale_items_delete_owner" on public.sale_items;
create policy "sale_items_delete_owner"
  on public.sale_items for delete
  to authenticated
  using (private.is_owner());

-- restock_deliveries
drop policy if exists "restock_select_team" on public.restock_deliveries;
create policy "restock_select_team"
  on public.restock_deliveries for select
  to authenticated
  using (private.is_staff_or_owner());

drop policy if exists "restock_insert_team" on public.restock_deliveries;
create policy "restock_insert_team"
  on public.restock_deliveries for insert
  to authenticated
  with check (
    private.is_staff_or_owner()
    and (received_by = (select auth.uid()) or private.is_owner())
  );

drop policy if exists "restock_update_owner" on public.restock_deliveries;
create policy "restock_update_owner"
  on public.restock_deliveries for update
  to authenticated
  using (private.is_owner())
  with check (private.is_owner());

drop policy if exists "restock_delete_owner" on public.restock_deliveries;
create policy "restock_delete_owner"
  on public.restock_deliveries for delete
  to authenticated
  using (private.is_owner());

-- stock_losses
drop policy if exists "stock_losses_select_team" on public.stock_losses;
create policy "stock_losses_select_team"
  on public.stock_losses for select
  to authenticated
  using (private.is_staff_or_owner());

drop policy if exists "stock_losses_insert_team" on public.stock_losses;
create policy "stock_losses_insert_team"
  on public.stock_losses for insert
  to authenticated
  with check (
    private.is_staff_or_owner()
    and (recorded_by = (select auth.uid()) or private.is_owner())
  );

drop policy if exists "stock_losses_update_owner" on public.stock_losses;
create policy "stock_losses_update_owner"
  on public.stock_losses for update
  to authenticated
  using (private.is_owner())
  with check (private.is_owner());

drop policy if exists "stock_losses_delete_owner" on public.stock_losses;
create policy "stock_losses_delete_owner"
  on public.stock_losses for delete
  to authenticated
  using (private.is_owner());

-- expenses
drop policy if exists "expenses_select_team" on public.expenses;
create policy "expenses_select_team"
  on public.expenses for select
  to authenticated
  using (private.is_staff_or_owner());

drop policy if exists "expenses_insert_team" on public.expenses;
create policy "expenses_insert_team"
  on public.expenses for insert
  to authenticated
  with check (
    private.is_staff_or_owner()
    and (recorded_by = (select auth.uid()) or private.is_owner())
  );

drop policy if exists "expenses_update_owner" on public.expenses;
create policy "expenses_update_owner"
  on public.expenses for update
  to authenticated
  using (private.is_owner())
  with check (private.is_owner());

drop policy if exists "expenses_delete_owner" on public.expenses;
drop policy if exists "expenses_delete_team_today_or_owner" on public.expenses;
create policy "expenses_delete_team_today_or_owner"
  on public.expenses for delete
  to authenticated
  using (
    private.is_owner()
    or (
      private.is_staff_or_owner()
      and recorded_by = (select auth.uid())
      and (created_at at time zone 'Asia/Jakarta')::date = (now() at time zone 'Asia/Jakarta')::date
    )
  );

-- daily_closings
drop policy if exists "daily_closings_select_team" on public.daily_closings;
create policy "daily_closings_select_team"
  on public.daily_closings for select
  to authenticated
  using (private.is_staff_or_owner());

drop policy if exists "daily_closings_insert_team" on public.daily_closings;
create policy "daily_closings_insert_team"
  on public.daily_closings for insert
  to authenticated
  with check (
    private.is_staff_or_owner()
    and (closed_by = (select auth.uid()) or private.is_owner())
  );

drop policy if exists "daily_closings_update_owner" on public.daily_closings;
create policy "daily_closings_update_owner"
  on public.daily_closings for update
  to authenticated
  using (private.is_owner())
  with check (private.is_owner());

drop policy if exists "daily_closings_delete_owner" on public.daily_closings;
create policy "daily_closings_delete_owner"
  on public.daily_closings for delete
  to authenticated
  using (private.is_owner());
