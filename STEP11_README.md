# خطوة 11 — حل نهائي لإدارة المستخدمين عبر Edge Function

## المشكلة اللي اتحلت
من خطوة 5: التطبيق front-end بحت ومعندوش Supabase Service Role Key، فكان
مستحيل (من غير باك إند):
1. تغيير كلمة مرور مستخدم تاني.
2. حذف حساب Auth فعليًا (كان بيتحذف بس صف البيانات من `public.users`).

## الحل
دالة Edge Function جديدة اسمها **`admin-users`** (الكود في
`supabase/functions/admin-users/index.ts`) بتشتغل على سيرفرات Supabase
نفسها، وهي الوحيدة اللي شايفة الـ Service Role Key — مش موجود في أي كود
واجهة (`.html` أو `supabase.js`) خالص.

**آلية الأمان:**
1. أي نداء للدالة لازم يبعت `Authorization: Bearer <access_token>` بتاع
   المستخدم المسجّل دخول حاليًا.
2. الدالة بتتحقق من هوية المتصل من التوكن ده، وبعدين بتقرأ صف المستخدم من
   `public.users` وتتأكد إن `role = 'admin'` — لو مش admin بترفض الطلب
   (403) قبل أي حاجة تانية.
3. لو التحقق نجح، بتنفّذ الإجراء المطلوب باستخدام عميل مبني بمفتاح Service
   Role (الوحيد القادر يوصل لـ `auth.admin.*`).

الإجراءات المدعومة:
- **`set_password`** — تغيير كلمة مرور أي مستخدم فعليًا (`auth.admin.updateUserById`).
- **`delete_user`** — حذف حساب Auth بالكامل (`auth.admin.deleteUser`) — صف
  `public.users` بيتحذف تلقائيًا معاه بسبب `on delete cascade` الموجود
  أصلًا في `database_schema.sql`، فمفيش خطوة تنظيف إضافية مطلوبة.

## التعديلات في الكود
- **`supabase.js`**: دالة جديدة `callAdminUsersFunction()` بتنادي الـ Edge
  Function. `updateUser()` بقت تستخدمها لو `data.password` موجودة، و
  `deleteUser()` بقت تستخدمها كاملة بدل الحذف الجزئي القديم.
- **`users.html`**: حقل كلمة المرور بقى ظاهر في وضع "تعديل مستخدم" (اختياري
  — سيبه فاضي لو مش عايز تغيّره)، ورسالة تأكيد الحذف بقت توضّح إنه حذف
  نهائي حقيقي لحساب الدخول.

## خطوات النشر (لازم تتعمل مرة واحدة من جهازك)
محتاج [Supabase CLI](https://supabase.com/docs/guides/cli) مثبّت عندك. لو
مش مثبّت:
```bash
npm install -g supabase
```

### 1) سجّل دخول واربط المشروع
```bash
supabase login
cd hraa-tourism-system-main
supabase link --project-ref <PROJECT_REF>
```
`<PROJECT_REF>` هو الجزء اللي في رابط مشروعك، مثلًا لو الرابط
`https://brorzaovgdleimkpddge.supabase.co` فـ `PROJECT_REF` = `brorzaovgdleimkpddge`.

### 2) احصل على Service Role Key
من لوحة تحكم Supabase: `Project Settings` → `API` → `Project API keys` →
انسخ **`service_role`** (مش `anon`/`publishable`). المفتاح ده **سري جدًا**
— متحطوش في أي كود واجهة ولا تشاركه مع حد، هيتخزن كـ secret على سيرفر
Supabase بس.

### 3) خزّن المفتاح كـ secret للدالة
```bash
supabase secrets set SERVICE_ROLE_KEY=<القيمة اللي نسختها>
```

### 4) انشر الدالة
```bash
supabase functions deploy admin-users
```

بكده الدالة بقت شغالة على:
`https://<PROJECT_REF>.supabase.co/functions/v1/admin-users`
(نفس الدومين بتاع مشروعك، `supabase.js` بيبني الرابط ده تلقائيًا من
`SUPABASE_CONFIG.URL`، مفيش تعديل إضافي مطلوب في الكود).

### 5) اختبار سريع
من `users.html` (وانت مسجّل دخول كـ admin):
- افتح "تعديل" لمستخدم تاني، اكتب كلمة مرور جديدة، احفظ — المفروض تظهر
  "تم تحديث المستخدم بنجاح" بدل رسالة الخطأ القديمة.
- جرّب حذف مستخدم تجريبي — المفروض يختفي فورًا ومينفعش يسجّل دخول تاني
  بنفس البيانات القديمة.

## لو حصل خطأ
- **"دالة admin-users مش منشورة على Supabase بعد"**: يبقى خطوة 4 (النشر)
  متعملتش، أو اسم الدالة اتكتب غلط.
- **"الدالة مش معدّة صح — SERVICE_ROLE_KEY مش موجود"**: خطوة 3 (الـ secret)
  متعملتش، أو اتعملت على مشروع مختلف عن اللي اتربط في خطوة 1.
- **403 "الصلاحية دي متاحة للمدير بس"**: الحساب اللي مسجّل دخول بيه مش
  `role = 'admin'` في جدول `public.users`.
- أي خطأ تاني هيظهر نصه زي ما هو من Supabase نفسه في الـ toast، وده مقصود
  عشان تعرف تشخّص المشكلة بسرعة بدل رسالة عامة.
