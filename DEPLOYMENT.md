# 🚀 دليل النشر الكامل — Supabase + GitHub + Vercel

ثلاث مراحل بالترتيب: **قاعدة البيانات أولاً**، ثم المستودع، ثم ربط Vercel.
المدة المتوقعة: 25–35 دقيقة.

---

## المرحلة 1 — إعداد Supabase (قاعدة البيانات والمصادقة)

### 1.1 إنشاء المشروع

1. افتح [supabase.com](https://supabase.com) وسجّل دخولك (يمكنك استخدام GitHub).
2. **New project** → اختر اسماً مثل `tower-of-english`، وكلمة مرور قوية لقاعدة
   البيانات (احفظها)، وأقرب منطقة جغرافية (أوروبا/الشرق الأوسط).
3. انتظر دقيقتين حتى يصبح المشروع جاهزاً.

### 1.2 تشغيل ملفات SQL بالترتيب

من القائمة الجانبية افتح **SQL Editor → New query**، والصق محتوى كل ملف
وشغّله (Run) واحداً تلو الآخر — الترتيب إلزامي:

| الترتيب | الملف | ماذا ينشئ |
| --- | --- | --- |
| 1 | `supabase/schema.sql` | الجداول، RLS، RPCs الأساسية، Realtime، 10 أسئلة |
| 2 | `supabase/migrations/0002_step2_gameplay.sql` | الانضمام للغرف، الأسئلة الآمنة، المؤقّت، اللوبي |
| 3 | `supabase/migrations/0003_roles_teacher_stats.sql` | الأدوار، لوحة المدرس، الإحصائيات، 20 سؤالاً إضافياً |

✅ للتحقق: افتح **Table Editor** يجب أن ترى الجداول `profiles`, `questions`,
`room_matches`, `room_answers`، وداخل `questions` 30 سؤالاً.

### 1.3 إعدادات المصادقة

1. افتح **Authentication → Providers** وتأكد أن **Email** مفعّل.
2. للتجربة السريعة: في **Authentication → Sign In / Providers → Email**
   عطّل **Confirm email** (فيصبح التسجيل فورياً). للإنتاج اتركه مفعّلاً.
3. بعد نشر Vercel (المرحلة 3) ارجع إلى
   **Authentication → URL Configuration** وأضف:
   - **Site URL:** `https://YOUR-APP.vercel.app`
   - **Redirect URLs:**
     - `https://YOUR-APP.vercel.app/auth/callback`
     - `https://YOUR-APP.vercel.app/**`
   - وأبقِ `http://localhost:3000/**` للتجربة المحلية.

### 1.4 استخراج المفاتيح

افتح **Project Settings → API** وانسخ قيمتين:

- **Project URL** → شيء مثل `https://abcdefgh.supabase.co`
- **anon public key** → مفتاح طويل يبدأ بـ `eyJ...`

> ⚠️ المفتاح `anon` آمن للوجود في المتصفح لأنه محمي بـ RLS. لا تستخدم مفتاح
> `service_role` في كود الواجهة إطلاقاً.

### 1.5 ترقية حسابك إلى مدرس (اختياري)

بعد إنشاء حسابك من الموقع، شغّل هذا في SQL Editor مستبدلاً بريدك:

```sql
update public.profiles
   set role = 'teacher'
 where id = (select id from auth.users where email = 'you@university.edu');
```

---

## المرحلة 2 — رفع المشروع إلى GitHub

المستودع مُهيأ محلياً بفرع `main` وأول Commit جاهز. اختر طريقة واحدة:

### الطريقة أ — سطر الأوامر (موصى بها)

1. على [github.com/new](https://github.com/new) أنشئ مستودعاً باسم
   `tower-of-english` **دون** README أو .gitignore (المشروع يحويها مسبقاً).
2. من مجلد المشروع:

```bash
git remote add origin https://github.com/YOUR-USERNAME/tower-of-english.git
git push -u origin main
```

سيطلب GitHub تسجيل الدخول (استخدم Personal Access Token من
Settings → Developer settings بدل كلمة المرور).

### الطريقة ب — الرفع اليدوي بدون Git

1. على [github.com/new](https://github.com/new) أنشئ مستودعاً جديداً.
2. اضغط **uploading an existing file** واسحب كل ملفات المشروع **باستثناء**
   `node_modules` و`.next` (هما موجودان في `.gitignore` ولن يُرفعا عبر Git أصلاً).
3. Commit changes.

> 🔒 تأكد قبل الرفع أن `.env.local` غير موجود في المستودع — `.gitignore`
> يمنعه، والنسخة المرفوعة تحتوي فقط على `.env.local.example` كقالب.

---

## المرحلة 3 — النشر على Vercel

### 3.1 الاستيراد

1. افتح [vercel.com](https://vercel.com) وسجّل الدخول بحساب GitHub.
2. **Add New → Project** → اختر مستودع `tower-of-english` → **Import**.
3. Vercel يتعرف على Next.js تلقائياً — لا تغيّر إعدادات البناء
   (`npm run build` و`npm run start` مملوءة آلياً).

### 3.2 متغيرات البيئة

في شاشة الاستيراد افتح **Environment Variables** وأضف متغيرين (لبيئة
Production، ثم كررهما لـ Preview وDevelopment إن رغبت):

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://abcdefgh.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | المفتاح `anon` الطويل |

### 3.3 إصدار Node (اختياري لكن موصى به)

في **Settings → General → Node.js Version** اختر **22.x** لإسكات تحذير
دعم Supabase المستقبلي (التطبيق يعمل على 20 أيضاً).

### 3.4 النشر

اضغط **Deploy** وانتظر 1–2 دقيقة. عند النجاح ستحصل على رابط:
`https://tower-of-english-xxx.vercel.app`.

### 3.5 إكمال حلقة المصادقة

ارجع للخطوة 1.3 وضع رابط Vercel في **Supabase → URL Configuration**،
وإلا سيفشل تأكيد البريد وإعادة التوجيه بعد الدخول.

---

## ✅ اختبار شامل بعد النشر (Smoke Test)

1. افتح الرابط → تظهر صفحة الهبوط، وجرّب `/demo` بلا حساب.
2. أنشئ حسابين في متصفحين (أو نافذة عادية + نافذة خفية):
   - الحساب الأول: **Create a new room** وانسخ الكود.
   - الحساب الثاني: الصق الكود في **Join room**.
3. يضغط المضيف **Start the race**، يجيب الحساب الأول وتشاهد رمز الفريق
   يتحرك فوراً في المتصفح الثاني → Realtime يعمل.
4. اختبر المؤقّت (20 ثانية) وانتهاء الدور، ثم أوصل أحد الفريقين للطابق 10
   لرؤية نافذة الاحتفال والشارات.
5. افتح `/dashboard` للإحصائيات والمتصدرين، وبعد ترقيتك لمدرس ستظهر لوحة
   إضافة وأرشفة الأسئلة.

---

## 🔄 دورة التطوير بعد النشر

أي تعديل لاحقاً:

```bash
git add .
git commit -m "وصف التعديل"
git push
```

Vercel يعيد البناء والنشر تلقائياً خلال دقيقة، وكل فرع جانبي ينشئ له
**Preview Deployment** مستقل للمراجعة قبل الدمج.

لتعديل متغيرات البيئة لاحقاً: **Vercel → Settings → Environment Variables**
ثم Redeploy من تبويب Deployments.

---

## 🩺 حل المشكلات الشائعة

| العَرَض | السبب والحل |
| --- | --- |
| `Missing Supabase env vars` | المتغيران غير مضبوطين في Vercel — أضفهما ثم Redeploy. |
| فشل تسجيل الدخول/إعادة توجيه فارغة | نسيت وضع رابط Vercel في Supabase URL Configuration (الخطوة 3.5). |
| `relation does not exist` | أحد ملفات SQL لم يُشغّل أو خرج عن الترتيب — أعد تشغيل الملف الناقص. |
| الرموز لا تتحرك في المتصفح الثاني | تأكد أن ملفي `schema.sql` فعّلا publication: `alter publication supabase_realtime add table ...` |
| `TEACHER_ONLY` | حسابك ما زال بدور student — نفّذ SQL الترقية في الخطوة 1.5. |
| خطأ 500 بعد تحديث كبير على Vercel | Deployments → أحدث نشر → Redeploy (يمسح كاش البناء). |
| البريد التأكيدي لا يصل | عطّل Confirm email للتجربة، أو تحقق من Spam، أو استخدم Supabase SMTP مخصص في الإنتاج. |

---

## 📦 ما هو جاهز في الكود الحالي

- Middleware يحمي `/lobby` و`/room/*` و`/dashboard` ويعيد التوجيه لـ `/login`.
- لا أسرار في الكود: كل المفاتيح عبر متغيرات بيئة عامة + حماية RLS وRPC.
- البناء الإنتاجي `npm run build` و107 اختباراً ناجحاً محلياً قبل الرفع.
