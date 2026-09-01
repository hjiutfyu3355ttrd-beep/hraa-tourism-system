-- ================================================================
-- حراء للسياحة — قاعدة البيانات الكاملة
-- انسخ هذا الملف بالكامل والصقه في: Supabase Dashboard → SQL Editor → New query
-- ثم اضغط RUN مرة واحدة. آمن لإعادة التشغيل (IF NOT EXISTS في كل مكان).
-- ================================================================

create extension if not exists pgcrypto;

-- ================================================================
-- 1) جدول المستخدمين (يكمّل جدول auth.users المدمج في Supabase)
-- ================================================================
create table if not exists public.users (
    id uuid primary key references auth.users(id) on delete cascade,
    full_name text,
    email text,
    role text default 'user',              -- 'admin' أو 'user'
    company_name text,
    is_active boolean default true,
    created_at timestamptz default now()
);

-- ================================================================
-- 2) إعدادات النظام (لكل مستخدم إعداداته الخاصة: الاسم، العملة، الشعار...)
-- ================================================================
create table if not exists public.user_settings (
    id uuid primary key default gen_random_uuid(),
    user_id uuid unique references auth.users(id) on delete cascade,
    system_name text default 'حراء للسياحة',
    language text default 'ar',
    currency text default 'SAR',
    date_format text default 'ar',
    number_format text default 'ar',
    notify_transactions boolean default true,
    notify_debts boolean default true,
    notify_system boolean default false,
    logo_url text,
    dark_mode boolean default true,
    updated_at timestamptz default now()
);

-- ================================================================
-- 3) العملاء
-- ================================================================
create table if not exists public.clients (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    phone text,
    email text,
    address text,
    debt numeric default 0,
    visits integer default 0,
    last_visit date,
    created_at timestamptz default now()
);

-- ================================================================
-- 4) الرحلات
-- ================================================================
create table if not exists public.trips (
    id uuid primary key default gen_random_uuid(),
    trip_code text unique,
    trip_name text,
    trip_type text,
    departure_date date,
    return_date date,
    seats_total integer default 0,
    status text default 'مخطط',
    created_at timestamptz default now()
);

-- ================================================================
-- 5) المناديب (لازم قبل الحجوزات لأنها تشير إليه)
-- ================================================================
create table if not exists public.representatives (
    id uuid primary key default gen_random_uuid(),
    rep_name text not null,
    phone text,
    commission_rate numeric default 0,
    created_at timestamptz default now()
);

create table if not exists public.rep_transactions (
    id uuid primary key default gen_random_uuid(),
    rep_id uuid references public.representatives(id) on delete cascade,
    amount numeric not null,
    txn_date date,
    description text,
    created_at timestamptz default now()
);

-- ================================================================
-- 6) الحجوزات
-- ================================================================
create table if not exists public.bookings (
    id uuid primary key default gen_random_uuid(),
    booking_code text,
    client_id uuid references public.clients(id) on delete set null,
    trip_id uuid references public.trips(id) on delete set null,
    rep_id uuid references public.representatives(id) on delete set null,
    booking_value numeric default 0,
    paid_amount numeric default 0,
    status text default 'قيد الانتظار',
    notes text,
    booking_date date,
    created_at timestamptz default now()
);

-- ================================================================
-- 7) البنوك والحركات المالية
-- ================================================================
create table if not exists public.banks (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    account_number text,
    branch text,
    balance numeric default 0,
    created_at timestamptz default now()
);

create table if not exists public.transactions (
    id uuid primary key default gen_random_uuid(),
    date date,
    type text,                              -- 'وارد' أو 'صادر'
    category text,
    amount numeric not null,
    description text,
    reference text,
    opening_balance boolean default false,
    client_id uuid references public.clients(id) on delete set null,
    created_at timestamptz default now()
);

-- ================================================================
-- 8) الخدمات الإضافية
-- ================================================================
create table if not exists public.services (
    id uuid primary key default gen_random_uuid(),
    client_id uuid references public.clients(id) on delete set null,
    service_name text,
    price numeric default 0,
    quantity integer default 1,
    total numeric default 0,
    description text,
    date date,
    created_at timestamptz default now()
);

-- ================================================================
-- 9) رسائل الدعم والتواصل
-- ================================================================
create table if not exists public.support_messages (
    id uuid primary key default gen_random_uuid(),
    name text,
    email text,
    phone text,
    type text,
    message text,
    user_id uuid,
    created_at timestamptz default now()
);

-- ================================================================
-- 10) جداول احتياطية (مطلوبة فقط حتى لا تفشل بعض دوال التصدير/الحذف
--     الشاملة في supabase.js — غير مستخدمة حالياً في أي صفحة واجهة)
-- ================================================================
create table if not exists public.hotels (
    id uuid primary key default gen_random_uuid(),
    name text,
    created_at timestamptz default now()
);

create table if not exists public.cars (
    id uuid primary key default gen_random_uuid(),
    name text,
    created_at timestamptz default now()
);

-- ================================================================
-- 11) دالة عدّ المستخدمين (تستخدمها صفحة إنشاء الحساب لمعرفة
--     هل هذا أول مستخدم في النظام ليصبح مديراً تلقائياً)
-- ================================================================
create or replace function public.get_users_count()
returns integer
language sql
security definer
set search_path = public
as $$
    select count(*)::integer from public.users;
$$;

grant execute on function public.get_users_count() to anon, authenticated;

-- ================================================================
-- 12) تفعيل الحماية على مستوى الصفوف (RLS) على كل الجداول
-- ================================================================
alter table public.users              enable row level security;
alter table public.user_settings      enable row level security;
alter table public.clients            enable row level security;
alter table public.trips              enable row level security;
alter table public.representatives    enable row level security;
alter table public.rep_transactions   enable row level security;
alter table public.bookings           enable row level security;
alter table public.banks              enable row level security;
alter table public.transactions       enable row level security;
alter table public.services           enable row level security;
alter table public.support_messages   enable row level security;
alter table public.hotels             enable row level security;
alter table public.cars               enable row level security;

-- ================================================================
-- 13) سياسات الوصول (Policies)
-- ملاحظة: هذا نظام شركة واحدة يشترك فيه كل الموظفين المسجّلين في
-- نفس البيانات (كل موظف يشوف كل العملاء/الرحلات وليس بياناته فقط
-- فقط) — لذلك السياسة العامة هي: أي مستخدم "مسجّل دخول" (authenticated)
-- له صلاحية كاملة على جداول العمل. جدول users استثناء لازم يسمح
-- بالإضافة من anon لأن صفحة التسجيل تُدرج الصف الجديد قبل ما تكتمل
-- الجلسة رسمياً.
-- ================================================================

-- users: قراءة/تحديث/حذف لأي مستخدم مسجّل، وإضافة مسموحة حتى بدون تسجيل دخول (وقت التسجيل)
drop policy if exists "users_select" on public.users;
create policy "users_select" on public.users for select
    using (auth.role() = 'authenticated');

drop policy if exists "users_insert" on public.users;
create policy "users_insert" on public.users for insert
    with check (true);

drop policy if exists "users_update" on public.users;
create policy "users_update" on public.users for update
    using (auth.role() = 'authenticated');

drop policy if exists "users_delete" on public.users;
create policy "users_delete" on public.users for delete
    using (auth.role() = 'authenticated');

-- user_settings: كل مستخدم يدير إعداداته الخاصة فقط
drop policy if exists "settings_all" on public.user_settings;
create policy "settings_all" on public.user_settings for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- الجداول المشتركة بين كل موظفي الشركة: صلاحية كاملة لأي مستخدم مسجّل دخول
drop policy if exists "clients_all" on public.clients;
create policy "clients_all" on public.clients for all
    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "trips_all" on public.trips;
create policy "trips_all" on public.trips for all
    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "representatives_all" on public.representatives;
create policy "representatives_all" on public.representatives for all
    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "rep_transactions_all" on public.rep_transactions;
create policy "rep_transactions_all" on public.rep_transactions for all
    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "bookings_all" on public.bookings;
create policy "bookings_all" on public.bookings for all
    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "banks_all" on public.banks;
create policy "banks_all" on public.banks for all
    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "transactions_all" on public.transactions;
create policy "transactions_all" on public.transactions for all
    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "services_all" on public.services;
create policy "services_all" on public.services for all
    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "hotels_all" on public.hotels;
create policy "hotels_all" on public.hotels for all
    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "cars_all" on public.cars;
create policy "cars_all" on public.cars for all
    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- support_messages: الإضافة والقراءة لأي مستخدم مسجّل دخول (صفحة الدعم داخل النظام بعد تسجيل الدخول)
drop policy if exists "support_all" on public.support_messages;
create policy "support_all" on public.support_messages for all
    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ================================================================
-- تم! افتح Table Editor للتأكد إن كل الجداول ظهرت بنجاح.
-- ================================================================
