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
- **Vitest + Testing Library** للاختبارات (107 اختباراً، كلها خضراء)
- النشر: Vercel، قاعدة البيانات: Supabase

## 3. خريطة الكود

```
src/
  app/                      # مسارات App Router
    page.tsx                # صفحة هبوط عامة
    demo/                   # playground محلي بلا حساب ولا Supabase
    login/                  # نموذج Auth (تبويبا دخول/تسجيل)
    lobby/                  # محمي: إنشاء/انضمام للغرف (Server Component)
    room/[code]/            # محمي: غرفة اللعب (GameRoom)
    dashboard/              # محمي: إحصائيات + متصدرين + لوحة المدرس
    auth/callback/          # تبادل رمز تأكيد البريد
  components/               # مكونات العميل
    Tower.tsx               # البرج البصري 10 طوابق + رموز الفرق المتحركة
    GameRoom.tsx            # منسّق الغرفة: Realtime + Presence + مؤقّت + صوت
    QuestionCard.tsx        # السؤال والمؤقّت وكشف الإجابة بعد الإرسال
    CelebrationModal.tsx    # نافذة الفوز والشارات والكونفيتي
    LobbyPanel.tsx, AuthForm.tsx, PresenceAvatars.tsx,
    StatsCards.tsx, Leaderboard.tsx, MatchHistory.tsx,
    SoundToggle.tsx, RoleSwitcher.tsx, AppHeader.tsx, SignOutButton.tsx
    teacher/QuestionManager.tsx  # CRUD بنك الأسئلة (للمدرس فقط)
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
    forms.ts                # تحقق المدخلات ورموز الغرف ورسائل الأخطاء
    questionForm.ts         # تحقق نموذج سؤال المدرس
    env.ts                  # كشف إعداد Supabase
    supabaseClient.ts       # عميل المتصفح (singleton)
    supabase/server.ts      # عميل Server Components
    supabase/middleware.ts  # حارس الجلسات والمسارات المحمية
  middleware.ts             # يفوّض إلى supabase/middleware
supabase/
  schema.sql                          # Step 1: جداول + RLS + RPCs + Realtime
  migrations/0002_step2_gameplay.sql  # انضمام/أسئلة آمنة/مؤقّت/لوبي
  migrations/0003_roles_teacher_stats.sql # أدوار/لوحة مدرس/إحصائيات +20 سؤالاً
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
4. الأدوار: الطالب لا يعدّل `role` بنفسه (`revoke update (role)`)؛ التغيير
   عبر `update_my_role` فقط.
5. منطق اللعبة والإحصائيات والتحقق **دوال نقية بلا React/Supabase** لتظل
   قابلة للاختبار بسهولة — أي قاعدة عمل جديدة ضعها في `lib/` واكتب اختبارها.

## 5. الأوامر ومعايير الجودة

```bash
npm install
npm run dev        # تطوير على :3000 (اربط -H 0.0.0.0 داخل الحاويات)
npm test           # 107 اختباراً — يجب أن تبقى كلها خضراء
npm run typecheck  # فحص TypeScript الصارم — صفر أخطاء
npm run build      # بناء إنتاجي
```

قواعد: أي ميزة جديدة تُرافق باختبارات. لا ترفع أبداً `.env.local` أو أي سر.
المتغيرات المطلوبة في بيئة التشغيل: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY` (القيم في Vercel، وللتطوير في `.env.local`
بناء على `.env.local.example`).

## 6. الحالة الحالية (لحظة التسليم)

- [x] Steps 1–3 مكتملة: المخطط والبرج والـ Realtime، المصادقة واللوبي
      والمؤقّت وPresence، الأدوار ولوحة المدرس والإحصائيات والصوت.
- [x] 107/107 اختبارات ناجحة، typecheck نظيف، production build ناجح.
- [x] مستودع Git محلي بفرع `main` و3 commits، وسيرفر CI في
      `.github/workflows/ci.yml`.
- [ ] **ناقص خارج الكود**: تشغيل ملفات SQL الثلاثة على مشروع Supabase حي،
      رفع المستودع إلى GitHub، النشر على Vercel مع متغيرات البيئة، ثم ضبط
      Supabase URL Configuration على رابط Vercel. التفاصيل في `DEPLOYMENT.md`.

## 7. المهمة المطلوبة من الوكيل المستلِم (حال كانت محددة)

النطاق الافتراضي إن لم يُذكر غيره:
1. لا تعدّل ملفات المصدر ما لم يُطلب صراحة.
2. إن طُلب رفع المشروع: ادفع شجرة `main` الحالية كما هي إلى مستودع GitHub
   المحدد (اسم المستودع: **1x1winner**) دون إعادة هيكلة أو تغيير إصدارات
   الحزم.
3. شغّل `npm ci && npm test && npm run build` للتحقق قبل إعلان النجاح.
4. أي انحراف عن هذه التعليمات وثّقه في ردك مع مبرره.

## 8. اقتراحات Step 4 (للعمل المستقبلي فقط)

موافقة مسؤول على ترقية المدرس · أسئلة استماع صوتية · وضع أفضل من 3 جولات ·
لوحة أستاذ حية لمراقبة القاعة وتصدير CSV/PDF · PWA وإشعارات الجوال.
