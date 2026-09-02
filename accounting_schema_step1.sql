-- ================================================================
-- حراء للسياحة — الخطوة 1: المحرك المحاسبي (دليل حسابات + قيود مزدوجة + سندات)
-- انسخ هذا الملف بالكامل والصقه في: Supabase Dashboard → SQL Editor → New query
-- يُشغَّل بعد ملف database_schema.sql الأساسي. آمن لإعادة التشغيل.
-- ================================================================

create extension if not exists pgcrypto;

-- ================================================================
-- 1) دليل الحسابات (Chart of Accounts)
-- ================================================================
create table if not exists public.chart_of_accounts (
    id uuid primary key default gen_random_uuid(),
    code text unique not null,
    name text not null,
    account_type text not null,     -- 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
    parent_code text,
    is_default boolean default false,   -- حسابات أساسية للنظام لا يمكن حذفها
    is_active boolean default true,
    created_at timestamptz default now()
);

-- ================================================================
-- 2) القيود اليومية (رأس القيد)
-- ================================================================
create table if not exists public.journal_entries (
    id uuid primary key default gen_random_uuid(),
    entry_no text,
    entry_date date not null default current_date,
    description text,
    source_type text,     -- 'voucher' | 'booking' | 'trip_expense' | 'manual' ...
    source_id uuid,        -- معرف المستند المصدر (سند/حجز/مصروف رحلة) لو موجود
    created_at timestamptz default now()
);

-- ================================================================
-- 3) بنود القيد (سطور مدين/دائن)
-- ================================================================
create table if not exists public.journal_entry_lines (
    id uuid primary key default gen_random_uuid(),
    entry_id uuid references public.journal_entries(id) on delete cascade,
    account_id uuid references public.chart_of_accounts(id),
    debit numeric default 0,
    credit numeric default 0,
    description text,
    created_at timestamptz default now()
);

create index if not exists idx_jel_entry on public.journal_entry_lines(entry_id);
create index if not exists idx_jel_account on public.journal_entry_lines(account_id);
create index if not exists idx_je_date on public.journal_entries(entry_date);

-- ================================================================
-- 4) السندات (قبض / صرف) + الإذون
-- ================================================================
create table if not exists public.vouchers (
    id uuid primary key default gen_random_uuid(),
    voucher_no text,
    voucher_type text not null,    -- 'قبض' | 'صرف' | 'اذن قبض' | 'اذن صرف'
    voucher_date date not null default current_date,
    cash_account_id uuid references public.chart_of_accounts(id),   -- الصندوق / البنك
    counter_account_id uuid references public.chart_of_accounts(id), -- الحساب المقابل (عميل/مندوب/مورد/مصروف/إيراد)
    party_type text,     -- 'client' | 'representative' | 'supplier' | 'other'
    party_id uuid,
    party_name text,
    amount numeric not null,
    description text,
    journal_entry_id uuid references public.journal_entries(id) on delete set null,
    created_at timestamptz default now()
);

create index if not exists idx_vouchers_date on public.vouchers(voucher_date);

-- ================================================================
-- 5) تفعيل RLS وسياسات الوصول (بنفس نمط باقي جداول النظام)
-- ================================================================
alter table public.chart_of_accounts   enable row level security;
alter table public.journal_entries     enable row level security;
alter table public.journal_entry_lines enable row level security;
alter table public.vouchers            enable row level security;

drop policy if exists "coa_all" on public.chart_of_accounts;
create policy "coa_all" on public.chart_of_accounts for all
    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "je_all" on public.journal_entries;
create policy "je_all" on public.journal_entries for all
    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "jel_all" on public.journal_entry_lines;
create policy "jel_all" on public.journal_entry_lines for all
    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "vouchers_all" on public.vouchers;
create policy "vouchers_all" on public.vouchers for all
    using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ================================================================
-- 6) دليل الحسابات الافتراضي (يُدرج مرة واحدة فقط)
-- ================================================================
insert into public.chart_of_accounts (code, name, account_type, parent_code, is_default) values
    ('1000', 'الأصول', 'asset', null, true),
    ('1100', 'الصندوق', 'asset', '1000', true),
    ('1200', 'البنوك', 'asset', '1000', true),
    ('1300', 'العملاء (مدينون)', 'asset', '1000', true),
    ('2000', 'الخصوم', 'liability', null, true),
    ('2100', 'الموردون (دائنون)', 'liability', '2000', true),
    ('2200', 'أرصدة المناديب المستحقة', 'liability', '2000', true),
    ('3000', 'حقوق الملكية', 'equity', null, true),
    ('3100', 'رأس المال', 'equity', '3000', true),
    ('3200', 'الأرباح المرحلة', 'equity', '3000', true),
    ('4000', 'الإيرادات', 'revenue', null, true),
    ('4100', 'إيرادات الرحلات', 'revenue', '4000', true),
    ('4200', 'إيرادات خدمات إضافية', 'revenue', '4000', true),
    ('5000', 'المصروفات', 'expense', null, true),
    ('5100', 'مصروفات الرحلات - الانتقالات', 'expense', '5000', true),
    ('5200', 'مصروفات الرحلات - الفنادق', 'expense', '5000', true),
    ('5300', 'مصروفات الرحلات - الطيران', 'expense', '5000', true),
    ('5400', 'مصروفات الرحلات - تأشيرات الوكيل', 'expense', '5000', true),
    ('5500', 'مصروفات الرحلات - الباركود', 'expense', '5000', true),
    ('5600', 'مصروفات إدارية وعمومية', 'expense', '5000', true),
    ('5700', 'عمولات المناديب', 'expense', '5000', true)
on conflict (code) do nothing;

-- ================================================================
-- تم! تحقق من ظهور الجداول الأربعة الجديدة في Table Editor:
-- chart_of_accounts, journal_entries, journal_entry_lines, vouchers
-- ================================================================
