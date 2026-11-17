-- REFFMARINE initial database schema
-- Jalankan di Supabase > SQL Editor. Jangan masukkan service_role key ke frontend.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'employee' check (role in ('admin','employee')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sku text unique,
  unit text not null default 'kg',
  selling_price numeric(14,2) not null default 0 check (selling_price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.freezers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  address text,
  credit_limit numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  purchase_no text not null unique,
  supplier_id uuid references public.suppliers(id),
  purchase_date timestamptz not null default now(),
  total numeric(14,2) not null default 0,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.stock_batches (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  freezer_id uuid references public.freezers(id),
  purchase_id uuid references public.purchases(id),
  batch_code text not null,
  received_at timestamptz not null default now(),
  expiry_date date,
  initial_kg numeric(14,3) not null check (initial_kg >= 0),
  remaining_kg numeric(14,3) not null check (remaining_kg >= 0),
  purchase_price_per_kg numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  product_id uuid not null references public.products(id),
  batch_id uuid references public.stock_batches(id),
  quantity_kg numeric(14,3) not null check (quantity_kg > 0),
  purchase_price_per_kg numeric(14,2) not null check (purchase_price_per_kg >= 0),
  line_total numeric(14,2) not null
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  sale_no text not null unique,
  customer_id uuid references public.customers(id),
  sale_date timestamptz not null default now(),
  subtotal numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  payment_method text not null check (payment_method in ('cash','transfer','credit')),
  paid_amount numeric(14,2) not null default 0,
  change_amount numeric(14,2) not null default 0,
  status text not null default 'completed' check (status in ('completed','cancelled')),
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid not null references public.products(id),
  batch_id uuid references public.stock_batches(id),
  quantity_kg numeric(14,3) not null check (quantity_kg > 0),
  unit_price_snapshot numeric(14,2) not null check (unit_price_snapshot >= 0),
  line_total numeric(14,2) not null
);

create table if not exists public.cash_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_date timestamptz not null default now(),
  direction text not null check (direction in ('in','out')),
  category text not null,
  description text,
  amount numeric(14,2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('cash','transfer')),
  sale_id uuid references public.sales(id),
  purchase_id uuid references public.purchases(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_batches_product on public.stock_batches(product_id);
create index if not exists idx_batches_freezer on public.stock_batches(freezer_id);
create index if not exists idx_sales_date on public.sales(sale_date);
create index if not exists idx_purchases_date on public.purchases(purchase_date);

-- Helper role checks
create or replace function public.current_user_role()
returns text language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() and active = true $$;

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.freezers enable row level security;
alter table public.suppliers enable row level security;
alter table public.customers enable row level security;
alter table public.purchases enable row level security;
alter table public.stock_batches enable row level security;
alter table public.purchase_items enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.cash_transactions enable row level security;

-- Signed-in active users can read operational data.
create policy "profile self or admin read" on public.profiles for select to authenticated
using (id = auth.uid() or public.current_user_role() = 'admin');
create policy "admin manage profiles" on public.profiles for all to authenticated
using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

do $$
declare t text;
begin
  foreach t in array array['products','freezers','suppliers','customers','purchases','stock_batches','purchase_items','sales','sale_items','cash_transactions']
  loop
    execute format('create policy "active users read %1$s" on public.%1$I for select to authenticated using (public.current_user_role() in (''admin'',''employee''))',t);
    execute format('create policy "staff insert %1$s" on public.%1$I for insert to authenticated with check (public.current_user_role() in (''admin'',''employee''))',t);
    execute format('create policy "admin update %1$s" on public.%1$I for update to authenticated using (public.current_user_role() = ''admin'') with check (public.current_user_role() = ''admin'')',t);
    execute format('create policy "admin delete %1$s" on public.%1$I for delete to authenticated using (public.current_user_role() = ''admin'')',t);
  end loop;
end $$;

-- Create profile automatically for each new auth user.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id,full_name,role)
  values(new.id, coalesce(new.raw_user_meta_data->>'full_name',split_part(new.email,'@',1)), 'employee')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- IMPORTANT: setelah akun Admin pertama dibuat, ubah role-nya menjadi admin
-- dari SQL Editor: update public.profiles set role='admin' where id='UUID-AKUN-ADMIN';
