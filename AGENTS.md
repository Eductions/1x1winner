# AGENTS.md — تعليمات التشغيل لأي وكيل ذكاء اصطناعي

> هذا الملف هو عقد الاستلام (handoff contract). اقرأه كاملاً قبل أي تعديل.
> المشروع شبه مكتمل وتم بناؤه عبر ثلاث خطوات بمنهجية TDD — **لا تبدأ من جديد ولا
> تعيد كتابة ما هو موجود**. مهمتك الاستمرار من قسم "الحالة الحالية".

## 1. نظرة عامة على المنتج

**Tower of English** — لعبة ويب تعليمية لطلاب الجامعة: فريقان (A/B) يتسابقان
لصعود برج من 10 طوابق. كل إجابة إنجليزية صحيحة تصعّد فريقاً طابقاً، وأول فريق
يصل الطابق 10 يفوز. جمهور اللعبة طلاب جامعيون، والهوية بصرية Gamified داكنة.

## 2. الحزمة التقنية (لا تستبدلها)

- **Next.js 15** (App Router) + **TypeScript** الصارم (`strict: true`)
- **Tailwind CSS v4** (إعداد PostCSS، الصنف المشترك `.input` في globals.css)
- **Framer Motion** للحركة + **lucide-react** للأيقونات
- **Supabase**: Auth (عبر `@supabase/ssr`)، Postgres RPCs، Realtime، Presence
- **Vitest + Testing Library** للاختبارات (135 اختباراً، كلها خضراء)
- النشر: Vercel، قاعدة البيانات: Supabase

## 3. خريطة الكود

```
src/
  app/                      # مسارات App Router
    page.tsx                # صفحة هبوط عامة
    demo/                   # playground محلي بلا حساب ولا Supabase
    login/                  # دخول بالاسم + الكود فقط (لا بريد ولا تسجيل ذاتي)
    setup/                  # إعداد لمرة واحدة لإنشاء المشرفة الأولى
    api/admin/players/      # Route Handlers محمية لإدارة حسابات الطلبة
    api/setup/supervisor/   # إنشاء المشرفة الأولى بمفتاح إعداد مالك سري
    lobby/                  # محمي: إنشاء/انضمام للغرف (Server Component)
    room/[code]/            # محمي: غرفة اللعب (GameRoom)
    dashboard/              # محمي: إحصائيات + لوحة تحكم المشرفة
    auth/callback/          # مسار جلسات Supabase (توافق داخلي؛ لا يستخدمه الطلبة)
  components/               # مكونات العميل
    Tower.tsx               # البرج البصري 10 طوابق + رموز الفرق المتحركة
    GameRoom.tsx            # منسّق الغرفة: Realtime + Presence + مؤقّت + صوت
    QuestionCard.tsx        # السؤال والمؤقّت وكشف الإجابة بعد الإرسال
    CelebrationModal.tsx    # نافذة الفوز والشارات والكونفيتي
    LobbyPanel.tsx, AuthForm.tsx, PresenceAvatars.tsx,
    StatsCards.tsx, Leaderboard.tsx, MatchHistory.tsx,
    SoundToggle.tsx, SetupSupervisorForm.tsx, AppHeader.tsx, SignOutButton.tsx
    teacher/QuestionManager.tsx  # CRUD بنك الأسئلة (للمشرفة فقط)
    teacher/PlayerManager.tsx    # إضافة/إعادة تعيين/تعطيل حسابات الطلبة
  hooks/
    useRoomChannel.ts       # اشتراك postgres_changes + RPCs الإجابة/الانتهاء
    useRoomPresence.ts      # Presence اللاعبين المتصلين
    useCountdown.ts         # مؤقّت الجولة (20 ثانية، إعادة تشغيل لكل سؤال)
    useSoundFx.ts           # Web Audio synth بلا ملفات صوت خارجية
  lib/
    types.ts                # كل الأنواع المشتركة + ثوابت الفرق
    gameLogic.ts            # منطق اللعبة النقي (نقاط، دمج الحالة، الشارات)
    quiz.ts                 # reducer جولة السؤال
    stats.ts                # دقة/ترتيب المتصدرين/الميداليات (نقي)
    forms.ts                # رموز الغرف ورسائل الأخطاء
    accessCredentials.ts    # قواعد الاسم/الكود + اشتقاق المعرّف الداخلي (نقي)
    server/playerAccounts.ts # منطق حسابات الخادم المحمي والمشرفة
    questionForm.ts         # تحقق نموذج سؤال المدرس
    env.ts                  # كشف إعداد Supabase
    supabaseClient.ts       # عميل المتصفح (singleton)
    supabase/server.ts      # عميل Server Components
    supabase/middleware.ts  # حارس الجلسات والمسارات المحمية
    supabase/admin.ts       # عميل Admin خادم فقط (service role) — لا يستورد للعميل
  middleware.ts             # يفوّض إلى supabase/middleware
supabase/
  schema.sql                          # Step 1: جداول + RLS + RPCs + Realtime
  migrations/0002_step2_gameplay.sql  # انضمام/أسئلة آمنة/مؤقّت/لوبي
  migrations/0003_roles_teacher_stats.sql # أدوار/لوحة مدرس/إحصائيات +20 سؤالاً
  migrations/0004_name_code_accounts.sql  # حسابات مُدارة بالاسم+الكود + إقفال الترقية الذاتية
```

## 4. القرارات المعمارية الحرجة (لا تكسرها)

1. **لا كتابة مباشرة على الجداول من العملاء إطلاقاً** — RLS يحجبها، كل
   التعديلات عبر دوال RPC `SECURITY DEFINER`.
2. **منع Race Conditions**: `SELECT ... FOR UPDATE` داخل RPCs + قيد فريد
   `(room_id, question_id, team)` في `room_answers` + عدّاد `version` على
   الغرفة، و`mergeRoomState()` في الواجهة يتجاهل الأحداث الأقدم.
3. **الإجابة الصحيحة لا تغادر قاعدة البيانات قبل الإجابة**: لا سياسة قراءة
   مباشرة على `questions`؛ الطلاب يجلبون عبر `get_question` (بلا مفتاح)،
   والمدرس فقط عبر `teacher_list_questions`.
4. **الحسابات مُدارة مركزياً بالاسم + الكود فقط**: لا تسجيل ذاتي ولا بريد
   ظاهر. داخلياً يشتق `accessCredentials.ts` معرّف Supabase غير قابل
   للتسليم من بصمة الاسم ويستخدم الكود ككلمة مرور. إنشاء/إعادة تعيين/
   تعطيل الطلبة يتم فقط من Route Handlers بعد التحقق من دور المشرفة،
   ومفتاح `service_role` يبقى حصرياً على الخادم. ترحيل 0004 يحذف
   `update_my_role` ويمنع الطالب من تعديل `username` أو `role`، ويرفض
   أي auth user غير مُدار (`MANAGED_ACCOUNTS_ONLY`). في قاعدة البيانات
   يبقى دور المشرفة هو القيمة التاريخية `teacher`.
5. منطق اللعبة والإحصائيات والتحقق **دوال نقية بلا React/Supabase** لتظل
   قابلة للاختبار بسهولة — أي قاعدة عمل جديدة ضعها في `lib/` واكتب اختبارها.

## 5. الأوامر ومعايير الجودة

```bash
npm install
npm run dev        # تطوير على :3000 (اربط -H 0.0.0.0 داخل الحاويات)
npm test           # 135 اختباراً — يجب أن تبقى كلها خضراء
npm run typecheck  # فحص TypeScript الصارم — صفر أخطاء
npm run build      # بناء إنتاجي
```

قواعد: أي ميزة جديدة تُرافق باختبارات. لا ترفع أبداً `.env.local` أو أي سر.
المتغيرات المطلوبة في بيئة التشغيل: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`، وسرّيا الخادم فقط
`SUPABASE_SERVICE_ROLE_KEY` و`SUPERVISOR_SETUP_SECRET` (القيم في Vercel،
وللتطوير في `.env.local` بناء على `.env.local.example`).

## 6. الحالة الحالية (لحظة التسليم)

- [x] Steps 1–4 مكتملة: المخطط والبرج والـ Realtime، المصادقة واللوبي
      والمؤقّت وPresence، الأدوار ولوحة المشرفة والإحصائيات والصوت، وحسابات
      الطلبة المُدارة بالاسم + الكود دون بريد أو تسجيل ذاتي.
- [x] 135/135 اختباراً ناجحاً، typecheck نظيف، production build ناجح.
- [x] المستودع مرفوع إلى GitHub (`Gentely/1x1winner`) وسيرفر CI في
      `.github/workflows/ci.yml`.
- [ ] **ناقص خارج الكود**: تشغيل ملفات SQL الأربعة بالترتيب على مشروع
      Supabase حي، ضبط متغيرات Vercel الأربع (عامان + سرّيا خادم)، نشر
      الموقع، إنشاء المشرفة الأولى من `/setup`، ثم إضافة الطلبة من لوحة
      التحكم. التفاصيل في `DEPLOYMENT.md`.

## 7. المهمة المطلوبة من الوكيل المستلِم (حال كانت محددة)

النطاق الافتراضي إن لم يُذكر غيره:
1. لا تعدّل ملفات المصدر ما لم يُطلب صراحة.
2. إن طُلب رفع المشروع: ادفع شجرة `main` الحالية كما هي إلى مستودع GitHub
   المحدد (اسم المستودع: **1x1winner**) دون إعادة هيكلة أو تغيير إصدارات
   الحزم.
3. شغّل `npm ci && npm test && npm run build` للتحقق قبل إعلان النجاح.
4. أي انحراف عن هذه التعليمات وثّقه في ردك مع مبرره.

## 8. اقتراحات Step 5 (للعمل المستقبلي فقط)

أسئلة استماع صوتية · وضع أفضل من 3 جولات · لوحة أستاذ حية لمراقبة القاعة
وتصدير CSV/PDF · PWA وإشعارات الجوال.
