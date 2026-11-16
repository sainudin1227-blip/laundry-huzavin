-- ============================================================================
-- LAUNDRY HUZAVIN — SUPABASE POSTGRESQL SCHEMA & RLS POLICIES
-- Jalankan SQL ini di Supabase SQL Editor apabila menghubungkan ke Supabase.
-- ============================================================================

create extension if not exists "pgcrypto";

-- 1. SERVICES
create table if not exists public.services (
  id text primary key,
  slug text unique not null,
  name text not null,
  price_per_kg integer not null check (price_per_kg > 0),
  description text not null,
  estimated_duration text not null default '1–2 hari',
  includes_ironing boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 1,
  updated_at timestamptz not null default now()
);

-- 2. CUSTOMERS
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  whatsapp text unique not null,
  last_address text,
  last_landmark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. ORDERS
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_code text unique not null,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  pickup_address text not null,
  pickup_landmark text not null default '',
  service_id text not null references public.services(id),
  service_name text not null,
  price_per_kg integer not null,
  estimated_weight numeric(6,2) not null check (estimated_weight >= 1),
  final_weight numeric(6,2),
  estimated_price integer not null check (estimated_price > 0),
  final_price integer,
  pickup_date text not null,
  pickup_time text not null,
  notes text not null default '',
  status text not null default 'ORDER_DITERIMA',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. ORDER STATUS HISTORY
create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  description text not null,
  updated_by text not null default 'Sistem',
  created_at timestamptz not null default now()
);

-- 5. GALLERY
create table if not exists public.gallery (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  image_url text not null,
  before_image_url text,
  caption text not null default '',
  is_illustration boolean not null default false,
  sort_order integer not null default 1,
  created_at timestamptz not null default now()
);

-- 6. TESTIMONIALS
create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  avatar_url text,
  rating integer not null check (rating between 1 and 5),
  comment text not null,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

-- 7. ADMIN PROFILES
create table if not exists public.admin_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  username text unique not null,
  password_hash text not null,
  display_name text not null default 'Admin Huzavin',
  must_change_password boolean not null default true,
  updated_at timestamptz not null default now()
);

-- 8. SITE SETTINGS
create table if not exists public.site_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- 9. CHATBOT CONVERSATIONS
create table if not exists public.chatbot_conversations (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  role text not null check (role in ('user', 'assistant')),
  message text not null,
  source text not null default 'gemini',
  created_at timestamptz not null default now()
);

-- ROW LEVEL SECURITY (RLS)
alter table public.services enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_status_history enable row level security;
alter table public.gallery enable row level security;
alter table public.testimonials enable row level security;
alter table public.admin_profiles enable row level security;
alter table public.site_settings enable row level security;
alter table public.chatbot_conversations enable row level security;

-- Public read access only for non-sensitive catalog/content tables
create policy "Public read active services" on public.services
  for select using (is_active = true);

create policy "Public read gallery" on public.gallery
  for select using (true);

create policy "Public read published testimonials" on public.testimonials
  for select using (is_published = true);

create policy "Public read site settings" on public.site_settings
  for select using (true);

-- Sensitive customer/order/admin tables are accessed strictly via verified server-side routes (Service Role)
-- or authenticated admin profiles.
create policy "Admin full access orders" on public.orders
  for all using (
    exists (
      select 1 from public.admin_profiles ap
      where ap.auth_user_id = auth.uid()
    )
  );

create policy "Admin full access order history" on public.order_status_history
  for all using (
    exists (
      select 1 from public.admin_profiles ap
      where ap.auth_user_id = auth.uid()
    )
  );
