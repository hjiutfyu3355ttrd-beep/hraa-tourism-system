-- ================================================================
-- حراء للسياحة — الخطوة 4 (SQL): ربط معاملات الخزينة اليدوية بقيد محاسبي حقيقي
-- انسخ هذا الملف بالكامل والصقه في: Supabase Dashboard → SQL Editor → New query
-- يُشغَّل بعد database_schema.sql و accounting_schema_step1/2/3.sql. آمن لإعادة التشغيل.
-- ================================================================

-- ================================================================
-- 1) حسابان جديدان في دليل الحسابات لتغطية فئات treasury.html
--    اللي معندهاش حساب مخصص حاليًا (سيارة / شركة / بنك)
-- ================================================================
insert into public.chart_of_accounts (code, name, account_type, parent_code, is_default) values
    ('4900', 'إيرادات أخرى', 'revenue', '4000', true),
    ('5800', 'مصروفات سيارات', 'expense', '5000', true)
on conflict (code) do nothing;

-- ================================================================
-- 2) عمود الربط: كل معاملة يدوية في جدول transactions (القديم) بقت
--    بتنشئ سند حقيقي (vouchers) — نحتاج نعرف مين مرتبط بمين عشان
--    التعديل/الحذف يقدر يعكس القيد المحاسبي الصحيح بدل ما يسيبه يتيم
-- ================================================================
alter table public.transactions
    add column if not exists linked_voucher_id uuid references public.vouchers(id) on delete set null;

-- ================================================================
-- 3) عمودان إضافيان لربط صف "تحويل إلى بنك" (اللي مش سند، ده قيد مباشر
--    عبر transferCashToBank) بالقيد المحاسبي والحساب البنكي المرتبطين بيه،
--    عشان حذف/تعديل الصف يقدر يعكس التحويل الفعلي بدل ما يسيبه معلّق
-- ================================================================
alter table public.transactions
    add column if not exists linked_journal_entry_id uuid references public.journal_entries(id) on delete set null;
alter table public.transactions
    add column if not exists linked_bank_account_id uuid references public.chart_of_accounts(id) on delete set null;

-- ================================================================
-- تم! تحقق من:
--  - ظهور حسابين جديدين (4900، 5800) في دليل الحسابات
--  - ظهور 3 أعمدة جديدة في جدول transactions:
--    linked_voucher_id, linked_journal_entry_id, linked_bank_account_id
-- ================================================================
