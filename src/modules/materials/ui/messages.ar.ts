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

// Quantity calculators (3.3, slice 1). Wording from the design: S20.1 «المواد والكميات», S22.1 «حاسبة الحديد», S22.2
// «نتيجة وزن الحديد», S23.1 «الحاسبات الأخرى», S23.2 «حجم الخرسانة». The design's example numbers are not reused.
export const calcTextAr = {
  back: 'رجوع',
  lyd: 'د.ل',
  optional: 'اختياري',
  requiredHint: 'الحقول المميزة بـ * مطلوبة.',

  home: {
    pageTitle: 'المواد والكميات',
    title: 'المواد والكميات',
    subtitle: 'الحاسبات وسجل الأسعار',
    quantitiesSoon: 'جدول الكميات وتسجيل الشراء قريبًا.',
    linksLabel: 'أدوات المواد',
    rebar: 'حاسبة الحديد',
    rebarNote: 'وزن الأسياخ من جدول التفريد',
    others: 'حاسبات أخرى',
    othersNote: 'حجم الخرسانة، مساحة التشطيب، عدد البلاط',
    prices: 'سجل الأسعار',
    pricesNote: 'ما دفعته وعروض الموردين بتواريخها',
  },

  rebar: {
    pageTitle: 'حاسبة الحديد',
    title: 'حاسبة الحديد',
    subtitle: 'تقدير وزن الأسياخ وفق المدخلات',
    source: 'أدخل القطر والطول والعدد من جدول تفريد الحديد الذي أعدّه المهندس. لا يقدّر النظام الحديد من المساحة أو الأبعاد.',
    diameter: 'قطر السيخ · مم',
    length: 'طول السيخ · متر',
    count: 'عدد الأسياخ',
    waste: 'نسبة الهدر · %',
    wasteHint: 'إن حدّدها المهندس أو المورد. لا يقترح النظام نسبة.',
    price: 'سعر الطن · د.ل',
    priceHint: 'من سجل الأسعار أو عرض المورد، لتقدير التكلفة.',
    scope: 'الحاسبة تقدّر الوزن فقط، ولا تختار أقطار أو تسليح العناصر الإنشائية.',
    submit: 'احسب الوزن التقريبي',
    noCoefficient: 'لا يوجد معامل وزن مسجّل للحديد، فلا يعرض النظام رقمًا. يُضاف المعامل حين يعتمده المهندس.',
  },

  rebarResult: {
    pageTitle: 'نتيجة وزن الحديد',
    title: 'نتيجة وزن الحديد',
    subtitle: (d: string, l: string, n: string) => `قطر ${d} مم · طول ${l} م · ${n} سيخًا`,
    weight: 'الوزن التقريبي',
    kg: 'كجم',
    tons: (t: string) => `حوالي ${t} طن`,
    withWaste: (pct: string) => `مع هدر ${pct}%`,
    withoutWaste: 'الوزن دون هدر',
    bar: 'وزن السيخ الواحد',
    approximate: 'قيمة تقريبية',
    totalLength: 'إجمالي الأطوال',
    meters: 'متر',
    lengthNote: (n: string, l: string) => `${n} × ${l} مترًا`,
    cost: 'التكلفة التقديرية',
    costNote: (price: string) => `بسعر ${price} د.ل للطن`,
    formula: 'المعادلة المستخدمة',
    formulaValue: (divisor: string) => `الوزن لكل متر = القطر² ÷ ${divisor}`,
    unreviewedShort: 'غير مراجَع',
    approvedShort: 'معتمد',
    unreviewed: 'المعامل غير مراجَع من مهندس بعد',
    reviewed: (by: string, on: string) => `اعتمد المعامل ${by} في ${on}`,
    disclaimer: 'نتيجة توضيحية لتقدير الشراء. يُراجع الوزن الفعلي ومواصفات المورد قبل الاعتماد.',
    edit: 'تعديل المدخلات',
    backToMaterials: 'العودة للمواد',
  },

  others: {
    pageTitle: 'الحاسبات الأخرى',
    title: 'الحاسبات الأخرى',
    subtitle: 'تقديرات كميات مبدئية للمشروع',
    open: (title: string) => `فتح حاسبة ${title}`,
    review: 'تراجع الكميات النهائية مقابل المخططات وجدول الكميات المعتمد.',
    notYet: 'الطوب والأسمنت والرمل تحتاج نسبًا هندسية لم يعتمدها المهندس بعد، فلم تُضف.',
  },

  geometric: {
    concrete: { title: 'حجم الخرسانة', unit: 'م³', formula: 'الطول × العرض × السمك', resultLabel: 'الحجم الهندسي' },
    area: { title: 'مساحة التشطيب', unit: 'م²', formula: 'الطول × العرض', resultLabel: 'المساحة' },
    tiles: { title: 'عدد البلاط', unit: 'قطعة', formula: 'المساحة ÷ مساحة البلاطة', resultLabel: 'عدد البلاط' },
    fields: {
      lengthM: 'الطول · م',
      widthM: 'العرض · م',
      thicknessM: 'السمك · م',
      areaM2: 'المساحة · م²',
      tileLengthCm: 'طول البلاطة · سم',
      tileWidthCm: 'عرض البلاطة · سم',
    },
    subtitle: 'مثال حسابي لعنصر مستطيل',
    noAdditions: 'دون إضافات',
    tilesNote: (tileArea: string) => `مساحة البلاطة ${tileArea} م² · مقرّبة لأعلى إلى قطعة كاملة، دون هدر أو قص`,
    disclaimer: 'مدخلات توضيحية، وليست توصية بسمك أو أبعاد إنشائية.',
    submit: 'احسب',
    backToCalculators: 'العودة للحاسبات',
  },
} as const;

export const calcErrorsAr: Record<'required' | 'invalid_number' | 'must_be_positive' | 'too_large' | 'must_be_whole', string> = {
  required: 'هذا الحقل مطلوب.',
  invalid_number: 'اكتب رقمًا موجبًا، مثل 12 أو 0.15',
  must_be_positive: 'يجب أن يكون الرقم أكبر من صفر.',
  too_large: 'الرقم كبير جدًا. تأكد من الوحدة.',
  must_be_whole: 'اكتب عددًا صحيحًا.',
};
