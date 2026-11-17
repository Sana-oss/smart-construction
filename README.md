# مدير مشاريع البناء السكنية — Smart Residential Construction Manager

مشروع تخرج: نظام ويب (عربي، RTL) لمساعدة أصحاب المنازل في ليبيا على متابعة مشاريع بنائهم.
المراجع في `docs/`، وقواعد العمل في `CLAUDE.md`.

## التشغيل المحلي
```bash
npm install
cp .env.example .env.local   # عبّئ قيم Supabase (مشروع تجريبي فقط)
npm run dev                  # http://localhost:3000
npm run check                # lint + typecheck + اختبارات الوحدات
npm run build
```

## اختبارات قاعدة البيانات
تحتاج PostgreSQL محليًا (قاعدة **مؤقتة** فقط، فالاختبار ينشئ أدوارًا وبيانات):
```bash
createdb scm_test
DATABASE_URL=postgresql:///scm_test npm run test:db
```

## الهيكل
```
src/app/            مسارات Next.js (رقيقة)
src/modules/<name>/ وحدات معزولة: domain / application / infra / ui + index.ts عام
src/shared-kernel/  المال، الأخطاء، الأحداث
src/platform/       التهيئة ومفاتيح التفعيل
supabase/migrations ترحيلات قاعدة البيانات (لا تُعدَّل بعد تطبيقها)
tests/db/           اختبارات RLS والقيود
docs/               المرجع والمعمارية والتحليل
```
قواعد الحدود بين الوحدات تُفرض في `eslint.config.mjs` وتُفحص في CI. جرّب استيرادًا مخالفًا وسترى الخطأ.

## النشر على Vercel

**الوضع الحالي (17 نوفمبر 2026):** الإعدادات جاهزة في المستودع، والمشروع لم يُنشأ بعد على Vercel.

**ما في المستودع:** `vercel.json` يضع دوال الخادم في فرانكفورت (`fra1`)، بجوار قاعدة البيانات `rakeeza-staging` (`eu-central-1`). بدونه تعمل الدوال في أمريكا ويعبر كل طلب الأطلسي. البناء والأوامر تُكتشف تلقائيًا (Next.js، `npm run build`).

**الخطوات:**
1. في Vercel، داخل فريق «Sanad's projects»: **Add New → Project**، ثم اختر المستودع `Sana-oss/smart-construction`. اسم المشروع المقترح: `rakeeza`.
2. أضف متغيري البيئة **فقط** (Production وPreview):
   | المتغير | القيمة |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | عنوان مشروع Supabase التجريبي |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | المفتاح العام لمشروع Supabase التجريبي |
3. **لا تضف** `SUPABASE_SERVICE_ROLE_KEY` ولا `INTERNAL_WORKER_SECRET` ولا `ANTHROPIC_API_KEY`: لا يستعملها أي كود الآن، وكل مفتاح سرّي لا حاجة له خطر بلا فائدة (NFR-SEC-02). تُضاف حين تُبنى الميزة التي تحتاجها، ومفتاح الخدمة لا يُكتب أبدًا ببادئة `NEXT_PUBLIC_`.
4. انشر، ثم افتح الرابط من الهاتف وجرّب: الترحيب، والدخول، والمعالج، والمصروف السريع.

**تنبيهات:**
- **لا توجد قاعدة إنتاج بعد.** رابط «Production» في Vercel يعمل على قاعدة `rakeeza-staging` نفسها. لا تُدخلوا فيه بيانات حقيقية لأحد حتى تُنشأ قاعدة إنتاج منفصلة.
- **روابط المعاينة (Preview):** كل طلب دمج يحصل على رابط تجريبي يعمل على القاعدة التجريبية نفسها، وهذا مفيد للمراجعة قبل الدمج.
- **تحقق من شروط الخطة المجانية الحالية** في Vercel (خطة Hobby) وSupabase قبل الاعتماد عليهما (NFR-AVL-01): قد تتغير الحدود، وقد تتوقف قواعد Supabase المجانية عند عدم النشاط.
