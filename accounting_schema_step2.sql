-- ================================================================
-- حراء للسياحة — الخطوة 2: ربط العمليات بالمحاسبة + الموردين + تصنيفات تكاليف الرحلة
-- انسخ هذا الملف بالكامل والصقه في: Supabase Dashboard → SQL Editor → New query
-- يُشغَّل بعد database_schema.sql و accounting_schema_step1.sql. آمن لإعادة التشغيل.
-- ================================================================

create extension if not exists pgcrypto;

-- ================================================================
-- 1) جدول الموردين
-- ================================================================
create table if not exists public.suppliers (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    phone text,
    email text,
    address text,
    notes text,
    debt numeric default 0,          -- رصيد مستحق للمورد (مثل حقل debt في clients)
    created_at timestamptz default now()
);

alter table public.suppliers enable row level security;
drop policy if exists "suppliers_all" on public.suppliers;
create policy "suppliers_all" on public.suppliers for all
    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ================================================================
-- 2) استكمال دليل حسابات تكاليف الرحلة بمسميات العميل بالظبط
--    (أوفر باركود + باركود الغرفة كانا ناقصين من الخطوة 1)
-- ================================================================
insert into public.chart_of_accounts (code, name, account_type, parent_code, is_default) values
    ('5510', 'مصروفات الرحلات - أوفر باركود', 'expense', '5000', true),
    ('5520', 'مصروفات الرحلات - باركود الغرفة', 'expense', '5000', true)
on conflict (code) do nothing;

-- ================================================================
-- 3) جدول مصروفات الرحلة المُصنّفة (كل سطر = تكلفة من نوع محدد على رحلة معينة)
--    كل سطر بيتسجل بينشئ قيد يومية مزدوج تلقائيًا:
--      - لو الدفع نقدي/بنكي فوري: مدين = حساب المصروف (حسب التصنيف) ، دائن = الصندوق/البنك
--      - لو على الحساب (آجل) لمورد:  مدين = حساب المصروف (حسب التصنيف) ، دائن = حساب الموردون (2100)
-- ================================================================
create table if not exists public.trip_expenses (
    id uuid primary key default gen_random_uuid(),
    trip_id uuid references public.trips(id) on delete cascade,
    category_account_id uuid references public.chart_of_accounts(id),  -- أحد حسابات 5100..5520
    supplier_id uuid references public.suppliers(id) on delete set null,
    payment_method text not null default 'نقدي',   -- 'نقدي' (فوري من الصندوق/البنك) | 'آجل' (على حساب المورد)
    cash_account_id uuid references public.chart_of_accounts(id), -- الصندوق/البنك (مطلوب فقط لو الدفع نقدي)
    amount numeric not null,
    description text,
    expense_date date not null default current_date,
    journal_entry_id uuid references public.journal_entries(id) on delete set null,
    created_at timestamptz default now()
);

create index if not exists idx_trip_expenses_trip on public.trip_expenses(trip_id);
create index if not exists idx_trip_expenses_supplier on public.trip_expenses(supplier_id);

alter table public.trip_expenses enable row level security;
drop policy if exists "trip_expenses_all" on public.trip_expenses;
create policy "trip_expenses_all" on public.trip_expenses for all
    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ================================================================
-- 4) ربط السندات بالرحلة/الحجز/المورد (لتتبّع أفضل وكشف حساب المورد)
--    أعمدة اختيارية جديدة على جدول vouchers الموجود من الخطوة 1
-- ================================================================
alter table public.vouchers add column if not exists trip_id uuid references public.trips(id) on delete set null;
alter table public.vouchers add column if not exists booking_id uuid references public.bookings(id) on delete set null;

-- ================================================================
-- تم! تحقق من ظهور جدولين جديدين في Table Editor:
-- suppliers, trip_expenses
-- وتأكد من ظهور عمودين جديدين (trip_id, booking_id) في جدول vouchers
-- ================================================================
