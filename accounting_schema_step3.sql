-- ================================================================
-- حراء للسياحة — الخطوة 3: ربط كل بنك/صندوق حقيقي بحساب مستقل في دليل الحسابات
-- يحل مشكلة عدم تأثير السندات وحركات الحجوزات والمصروفات على أرصدة الخزينة،
-- لأنها كانت كلها بتترحّل على حساب واحد عام اسمه "البنوك" (1200) مش على
-- البنك/الصندوق الفعلي المطلوب.
-- انسخ هذا الملف كاملاً في: Supabase Dashboard → SQL Editor → New query
-- يُشغَّل بعد database_schema.sql و accounting_schema_step1.sql و step2.sql. آمن لإعادة التشغيل.
-- ================================================================

-- 1) عمود الربط: أي حساب في دليل الحسابات ممكن يشير لصف حقيقي في جدول banks
alter table public.chart_of_accounts
    add column if not exists linked_bank_id uuid references public.banks(id) on delete set null;

-- كل بنك مايكونش ليه غير حساب محاسبي واحد بس
create unique index if not exists idx_coa_linked_bank
    on public.chart_of_accounts(linked_bank_id)
    where linked_bank_id is not null;

-- ================================================================
-- 2) Backfill: إنشاء حساب محاسبي مستقل تلقائيًا لكل بنك/صندوق موجود عندك
--    حاليًا في جدول banks وليس له حساب مرتبط بعد (تحت المجموعة 12xx "البنوك")
-- ================================================================
do $$
declare
    b record;
    next_num integer;
    new_code text;
begin
    select coalesce(max(substring(code from 3)::integer), 0) + 1
        into next_num
        from public.chart_of_accounts
        where code ~ '^12[0-9]{2}$';

    for b in
        select * from public.banks
        where id not in (
            select linked_bank_id from public.chart_of_accounts
            where linked_bank_id is not null
        )
        order by created_at
    loop
        new_code := '12' || lpad(next_num::text, 2, '0');
        insert into public.chart_of_accounts (code, name, account_type, parent_code, is_default, linked_bank_id)
        values (new_code, b.name, 'asset', '1200', false, b.id)
        on conflict (code) do nothing;
        next_num := next_num + 1;
    end loop;
end $$;

-- ================================================================
-- تم! تحقق من عمود linked_bank_id الجديد في جدول chart_of_accounts، ومن
-- ظهور صف محاسبي مستقل لكل بنك من بنوكك تحت المجموعة 1200.
-- ================================================================
