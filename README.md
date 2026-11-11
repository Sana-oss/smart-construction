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
1. ارفع المستودع إلى GitHub.
2. في Vercel: **Add New Project** ثم اختر المستودع (يُكتشف Next.js تلقائيًا).
3. أضف متغيرات البيئة من `.env.example` في إعدادات المشروع.
   لا تضع مفتاح الخدمة (`SUPABASE_SERVICE_ROLE_KEY`) ببادئة `NEXT_PUBLIC_` أبدًا.
4. أنشئ مشروع Supabase **تجريبيًا** منفصلًا عن الإنتاج، وطبّق عليه كل ملفات `supabase/migrations/` بالترتيب (0001 ثم 0002 ثم 0003 ثم 0004).
5. **تحقق من شروط الخطة المجانية الحالية** في Vercel (خطة Hobby) وSupabase قبل الاعتماد عليهما:
   قد تتغير الحدود، وقد تتوقف قواعد Supabase المجانية عند عدم النشاط.
