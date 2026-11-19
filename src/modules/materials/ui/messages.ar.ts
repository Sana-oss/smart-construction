import type { PriceFailure } from '../application/prices';
import type { PriceErrorCode, PriceKind } from '../domain/price';

// Arabic text for the price log. Wording from the design: S24.1 «سجل الأسعار», S24.2 «تاريخ سعر …», S24.3 «إضافة سعر».
// The design's «بيانات توضيحية» and «أمثلة تصميمية» were demo notes; the app says instead that it never forecasts.

export const priceTextAr = {
  back: 'رجوع',
  lyd: 'د.ل',
  requiredHint: 'الحقول المميزة بـ * مطلوبة.',

  log: {
    pageTitle: 'سجل الأسعار',
    title: 'سجل الأسعار',
    subtitle: 'أسعار مسجلة للمشروع',
    lastUpdate: (date: string, unit: string) => `آخر تحديث: ${date} · لكل ${unit}`,
    expiringCount: (n: number) => (n === 1 ? 'عرض سعر واحد ينتهي خلال 7 أيام.' : `${n} عروض أسعار تنتهي خلال 7 أيام.`),
    empty: 'لا أسعار مسجلة بعد',
    emptyNote: 'سجّل ما دفعته أو ما عرضه عليك المورد، لتقارن الأسعار عبر الوقت.',
    noForecast: 'يعرض النظام ما سجلته فقط، ولا يتوقع الأسعار.',
    add: 'إضافة سعر',
    openLabel: (material: string, unit: string) => `تاريخ سعر ${material} لكل ${unit}`,
    added: 'حُفظ السعر.',
    deleted: 'حُذف السعر، وبقي أثره في سجل التدقيق.',
  },

  history: {
    pageTitle: 'تاريخ السعر',
    title: (material: string) => `تاريخ سعر ${material}`,
    subtitle: (unit: string) => `لكل ${unit} · أسعار المشروع المسجلة`,
    latest: 'آخر سعر',
    transport: (amount: string) => `نقل ${amount} د.ل`,
    noForecast: 'هذه أسعار سجلتها أنت فقط؛ لا توقع لما سيأتي.',
    addUpdate: 'إضافة تحديث للسعر',
    notFound: 'لا أسعار لهذه المادة بهذه الوحدة.',
    delete: 'حذف',
    deleteLabel: (date: string) => `حذف سعر ${date}`,
    deleteConfirm: (date: string) => `حذف سعر ${date}؟ تبقى قيمه في سجل التدقيق.`,
  },

  status: {
    paid: 'سعر مدفوع',
    quote: 'عرض مورد',
    expiring: (days: number) => (days === 0 ? 'ينتهي اليوم' : days === 1 ? 'ينتهي غدًا' : `ينتهي خلال ${days} أيام`),
    expired: 'عرض منتهي',
  },

  form: {
    pageTitle: 'إضافة سعر',
    title: 'إضافة سعر',
    subtitle: 'وثّق السعر ومصدره للمقارنة',
    material: 'المادة',
    unit: 'الوحدة',
    price: 'السعر · د.ل',
    kind: 'نوع السعر',
    kinds: { paid: 'سعر دفعته', quote: 'عرض من مورد' } satisfies Record<PriceKind, string>,
    supplier: 'المورد',
    date: 'التاريخ',
    expiresOn: 'العرض صالح حتى',
    expiresOnHint: 'للعروض فقط، إن ذكرها المورد.',
    transport: 'تكلفة النقل · د.ل',
    note: 'ملاحظات',
    optional: 'اختياري',
    submit: 'حفظ السعر',
    submitting: 'جارٍ الحفظ…',
  },
} as const;

export const priceErrorsAr: Record<PriceErrorCode, string> = {
  required: 'هذا الحقل مطلوب.',
  too_short: 'النص قصير جدًا.',
  too_long: 'النص طويل جدًا.',
  invalid_number: 'اكتب رقمًا صحيحًا بثلاث خانات عشرية على الأكثر، مثل 4,000 أو 42.5',
  must_be_positive: 'يجب أن يكون المبلغ أكبر من صفر.',
  too_large: 'الرقم كبير جدًا.',
  unknown_choice: 'اختر من القائمة.',
  invalid_date: 'التاريخ غير صحيح.',
  date_in_future: 'تاريخ السعر لا يكون بعد اليوم.',
  expiry_before_date: 'تاريخ انتهاء العرض لا يكون قبل تاريخ العرض.',
  expiry_only_for_quote: 'تاريخ الصلاحية للعروض فقط. اختر «عرض من مورد» أو امسح التاريخ.',
};

export const priceFailedAr: Record<PriceFailure | 'no_project', string> = {
  not_allowed: 'لا تملك صلاحية تسجيل الأسعار في هذا المشروع، أو انتهت الجلسة. سجّل الدخول من جديد.',
  rejected: 'تعذّر حفظ السعر. راجع البيانات وحاول مرة أخرى.',
  not_found: 'لم يُعثر على هذا السعر. ربما حُذف من قبل.',
  unavailable: 'تعذّر الاتصال الآن. تحقق من الاتصال وحاول مرة أخرى.',
  no_project: 'لا يوجد مشروع بعد. أنشئ مشروعك أولًا.',
};
