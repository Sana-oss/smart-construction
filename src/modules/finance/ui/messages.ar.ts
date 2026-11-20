import type { ExpenseFailure } from '../application/expense-gateway';
import type { Currency } from '../domain/currency';
import type { ExpenseErrorCode, ExpenseField, ExpenseType } from '../domain/expense';
import type { ExpensePeriod } from '../domain/expense-filter';

// Arabic text for the quick-expense screens. Wording from the design file (Design/Screens, outline):
// S14.1 «مصروف سريع», S14.2 «تم حفظ المصروف», S13.1 (expense types), S07.4 (back to the dashboard).

export const expenseTextAr = {
  pageTitle: 'مصروف سريع',
  back: 'رجوع',
  requiredHint: 'الحقول المميزة بـ * مطلوبة.',
  lyd: 'د.ل',

  form: {
    title: 'مصروف سريع',
    subtitle: 'سجّل تكلفة جديدة في خطوات بسيطة',
    name: 'اسم المصروف',
    amount: 'المبلغ · د.ل',
    type: 'نوع المصروف',
    typePlaceholder: 'اختر نوع المصروف',
    phase: 'المرحلة',
    noPhase: 'غير مرتبط بمرحلة',
    payee: 'المورد أو المستفيد',
    date: 'التاريخ',
    submit: 'حفظ المصروف',
    submitting: 'جارٍ الحفظ…',
    // Receipt photo (UC-07): optional, after the six fields, so the three required answers stay at the top.
    receipt: 'صورة الفاتورة',
    receiptOptional: 'اختياري',
    receiptPick: 'التقط صورة الفاتورة أو اخترها',
    receiptChange: 'تغيير الصورة',
    receiptRemove: 'إزالة الصورة',
    receiptPreparing: 'جارٍ تجهيز الصورة…',
    receiptConverting: 'جارٍ تحويل صورة الآيفون (HEIC)…',
    receiptUploading: 'جارٍ رفع صورة الفاتورة…',
    receiptNotImage: 'هذا الملف ليس صورة.',
    receiptTooLarge: 'الصورة كبيرة جدًا (30 ميغابايت على الأكثر).',
    receiptUnreadable: 'تعذّرت قراءة الصورة. جرّب صورة أخرى.',
    receiptHeicFailed: 'تعذّر تحويل صورة HEIC في هذا المتصفح. أرسلها بصيغة JPEG أو جرّب متصفحًا آخر.',
    receiptUploadFailed: 'تعذّر رفع صورة الفاتورة. تحقق من الاتصال وحاول مرة أخرى، أو أزل الصورة واحفظ دونها.',
  },

  saved: {
    title: 'تم حفظ المصروف',
    // Shown when the same request reached the server twice (weak connection, double tap): NFR-REL-01.
    duplicate: 'هذا المصروف محفوظ من قبل، ولم يُسجَّل مرة ثانية.',
    payee: 'المورد',
    noPayee: 'غير محدد',
    status: 'حالة التسجيل',
    statusValue: 'محفوظ',
    receipt: 'صورة الفاتورة',
    receiptAttached: 'مرفقة',
    receiptNone: 'بلا صورة',
    statusNote: 'مضاف إلى مصروفات المشروع',
    toList: 'عرض المصروفات',
    another: 'إضافة مصروف آخر',
  },

  // Expenses list. Wording from the design: S13.1 (list), S13.3 (empty state).
  list: {
    pageTitle: 'المصروفات',
    title: 'المصروفات',
    monthTotal: 'مصروفات هذا الشهر',
    allTotal: 'إجمالي المصروفات',
    startHint: 'ابدأ بإضافة أول مصروف',
    emptyTitle: 'لا توجد مصروفات بعد',
    emptyBody: 'سجّل الإنفاق لتتابع تكلفة المشروع وتقارنها بالميزانية.',
    emptySubtitle: 'لا توجد عمليات مسجلة لهذا المشروع',
    addFirst: 'إضافة أول مصروف',
    add: 'مصروف سريع',
    noTitle: 'مصروف بلا اسم',
    receipt: 'الفاتورة',
    receiptLabel: (title: string) => `صورة فاتورة: ${title}`,
    /** Each row opens its expense (decision of 19 Nov 2026). */
    openLabel: (title: string) => `فتح المصروف: ${title}`,
    updated: 'حُفظ التعديل، وسُجّل في سجل التدقيق.',
    deleted: 'حُذف المصروف، وبقي أثره في سجل التدقيق.',
    /** Shown when the project has more expenses than the list shows (EXPENSE_LIST_LIMIT). */
    olderHidden: (shown: number, total: number) => `يُعرض آخر ${shown} مصروفًا من ${total}. استخدم «التصفية والبحث» للوصول إلى الأقدم.`,
  },

  // Filter (design S13.2 «تصفية المصروفات») and the list's quick link «التصفية والبحث» (S13.1).
  filter: {
    pageTitle: 'تصفية المصروفات',
    title: 'تصفية المصروفات',
    subtitle: 'حدد النطاق المطلوب عرضه',
    search: 'بحث باسم المصروف أو المورد',
    period: 'الفترة',
    phase: 'المرحلة',
    allPhases: 'كل المراحل',
    type: 'نوع المصروف',
    allTypes: 'كل الأنواع',
    apply: 'تطبيق التصفية',
    clear: 'مسح التصفية',
    open: 'التصفية والبحث',
    openNote: 'بالاسم أو المورد أو الفترة أو المرحلة أو النوع',
    resultsTotal: 'مجموع النتائج',
    resultsSubtitle: (project: string) => `${project} · نتائج التصفية`,
    noResults: 'لا توجد مصروفات تطابق التصفية',
    noResultsHint: 'غيّر شروط التصفية أو امسحها لعرض كل المصروفات.',
    searchFor: (text: string) => `«${text}»`,
  },

  // Edit and delete one expense (decision of 19 Nov 2026). No design screen yet: built from S14.1's fields.
  edit: {
    pageTitle: 'تعديل المصروف',
    title: 'تعديل المصروف',
    subtitle: 'كل تعديل يُحفظ في سجل التدقيق مع القيم السابقة',
    submit: 'حفظ التعديل',
    submitting: 'جارٍ الحفظ…',
    receipt: 'صورة الفاتورة',
    receiptOpen: 'عرض صورة الفاتورة',
    receiptNone: 'لا توجد صورة فاتورة لهذا المصروف.',
    receiptFixed: 'لا تتغيّر الصورة من هنا.',
  },
  remove: {
    start: 'حذف المصروف',
    title: 'حذف هذا المصروف؟',
    body: 'سيُحذف المصروف من القائمة والمجاميع، وتُحذف صورة فاتورته إن وُجدت. تبقى قيمه في سجل التدقيق. لا يمكن التراجع عن الحذف.',
    confirm: 'نعم، احذف المصروف',
    deleting: 'جارٍ الحذف…',
    cancel: 'إلغاء',
  },
} as const;

/** «الفترة» choices (design S13.2; list decided 19 Nov 2026). */
export const expensePeriodAr: Record<ExpensePeriod, string> = {
  all: 'كل الفترات',
  this_month: 'هذا الشهر',
  last_month: 'الشهر الماضي',
  last_3_months: 'آخر 3 أشهر',
  this_year: 'هذه السنة',
};

/** The three expense types of the design (S13.1). Keys are stored; these labels are shown. */
export const expenseTypeAr: Record<ExpenseType, string> = {
  materials: 'مواد',
  labor: 'عمالة',
  services: 'خدمات',
};

/**
 * "5 مصروفات مسجلة", with Arabic number agreement (Intl plural categories for Arabic):
 * 0 zero, 1 one, 2 two, 3–10 few, 11–99 many, 100+ other.
 */
const arPlural = new Intl.PluralRules('ar');
export function expenseCountAr(n: number): string {
  switch (arPlural.select(n)) {
    case 'zero':
      return 'لا مصروفات مسجلة';
    case 'one':
      return 'مصروف واحد مسجل';
    case 'two':
      return 'مصروفان مسجلان';
    case 'few':
      return `${n} مصروفات مسجلة`;
    case 'many':
      return `${n} مصروفًا مسجلًا`;
    default:
      return `${n} مصروف مسجل`;
  }
}

export const expenseErrorsAr: Record<ExpenseErrorCode, string> = {
  required: 'هذا الحقل مطلوب.',
  too_short: 'النص قصير جدًا.',
  too_long: 'النص طويل جدًا.',
  invalid_number: 'اكتب رقمًا صحيحًا بثلاث خانات عشرية على الأكثر، مثل 12,000 أو 250.5',
  must_be_positive: 'يجب أن يكون المبلغ أكبر من صفر.',
  too_large: 'الرقم كبير جدًا.',
  unknown_choice: 'اختر من القائمة.',
  invalid_id: 'اختر من القائمة.',
  invalid_date: 'التاريخ غير صحيح.',
  date_in_future: 'تاريخ المصروف لا يكون بعد اليوم.',
};

export const expenseFailedAr: Record<ExpenseFailure | 'no_project', string> = {
  not_allowed: 'لا تملك صلاحية تسجيل مصروف في هذا المشروع، أو انتهت الجلسة. سجّل الدخول من جديد.',
  unknown_reference: 'المرحلة المختارة لا تخص هذا المشروع. اختر مرحلة أخرى.',
  rejected: 'تعذّر حفظ المصروف. راجع البيانات وحاول مرة أخرى.',
  receipt_missing: 'لم تصل صورة الفاتورة كاملة. اضغط «حفظ المصروف» مرة أخرى، أو احذف الصورة واحفظ دونها.',
  not_found: 'لم يُعثر على هذا المصروف. ربما حُذف من قبل.',
  unavailable: 'تعذّر حفظ المصروف الآن. تحقق من الاتصال ثم اضغط «حفظ المصروف» مرة أخرى: لن يُسجَّل مرتين.',
  no_project: 'لا يوجد مشروع بعد. أنشئ مشروعك أولًا.',
};

export type ExpenseFieldErrors = Partial<Record<ExpenseField, string>>;

/** Failures while editing or deleting: the same reasons, with words that fit (no «لن يُسجَّل مرتين» here). */
export const expenseChangeFailedAr: Record<ExpenseFailure | 'no_project', string> = {
  ...expenseFailedAr,
  not_allowed: 'لا تملك صلاحية تعديل مصروفات هذا المشروع، أو انتهت الجلسة. سجّل الدخول من جديد.',
  rejected: 'تعذّر حفظ التعديل. راجع البيانات وحاول مرة أخرى.',
  unavailable: 'تعذّر الاتصال الآن. تحقق من الاتصال وحاول مرة أخرى.',
};

/**
 * Obligations and expected income. Wording from the design: S16.1 «الالتزامات والدخل», S16.2 «إضافة حركة متوقعة»,
 * S18.1 «الرصيد المتوقع بعد 30 يومًا». Slice 1 of 3.7 (19 Nov 2026).
 */
export const cashflowTextAr = {
  pageTitle: 'الالتزامات والدخل',
  title: 'الالتزامات والدخل',
  subtitle: 'متابعة السيولة خلال 30 يومًا',
  liquidity: 'السيولة الحالية',
  liquidityMissing: 'غير معروفة',
  liquidityMissingNote: 'لم يُدخل «المتاح الآن» عند إنشاء المشروع، فلا يُحسب رصيد متوقع.',
  liquidityNote: (date: string) => `المتاح حتى ${date} مطروحًا منه المصروفات المسجلة منذ ذلك اليوم`,
  windowTotals: (income: string, obligations: string) => `دخل متوقع: ${income} · التزامات: ${obligations}`,
  balance: 'الرصيد المتوقع بعد 30 يومًا',
  // Split around the amount, so the screen can keep its minus sign in place (<bdi dir="ltr">).
  shortfallBefore: (date: string) => `عجز متوقع من ${date}: ينزل الرصيد إلى`,
  shortfallAfter: 'د.ل. الدخل الذي يصل بعد موعد الالتزام لا يغطيه.',
  overdue: (n: number) => (n === 1 ? 'التزام واحد فات موعده ولم يُحذف بعد.' : `${n} التزامات فات موعدها ولم تُحذف بعد.`),
  income: 'دخل متوقع',
  obligation: 'التزام',
  expectedOn: (date: string) => `متوقع ${date}`,
  dueOn: (date: string) => `مستحق ${date}`,
  overdueTag: 'فات موعده',
  empty: 'لا التزامات ولا دخل متوقع بعد',
  emptyNote: 'سجّل ما ستدفعه وما تنتظر وصوله، لترى رصيدك خلال الثلاثين يومًا القادمة.',
  doneHint: 'حين تدفع التزامًا أو يصل دخل، احذفه من هنا. والدفع نفسه يُسجَّل مصروفًا.',
  add: 'إضافة التزام أو دخل',
  added: 'حُفظت الحركة.',
  deleted: 'حُذفت الحركة، وبقي أثرها في سجل التدقيق.',
  delete: 'حذف',
  deleteLabel: (title: string) => `حذف: ${title}`,
  deleteConfirm: (title: string) => `حذف «${title}»؟ تبقى قيمه في سجل التدقيق.`,
  // FR-DEC-05 (shown with every result of the outlook)
  disclaimer: 'الحساب تقديري ويعتمد على البيانات المدخلة، وليس نصيحة مالية.',

  form: {
    pageTitle: 'إضافة حركة متوقعة',
    title: 'إضافة حركة متوقعة',
    subtitle: 'التزامات ودخل · لا تُسجل كمصروف مدفوع',
    kind: 'نوع الحركة',
    kindPlaceholder: 'اختر نوع الحركة',
    kinds: { income: 'دخل متوقع', obligation: 'التزام' },
    title_: 'الوصف',
    amount: 'المبلغ · د.ل',
    date: 'التاريخ المتوقع',
    party: 'المصدر أو المستفيد',
    submit: 'حفظ الحركة',
    submitting: 'جارٍ الحفظ…',
  },
} as const;

export const cashflowFailedAr: Record<ExpenseFailure | 'no_project', string> = {
  ...expenseFailedAr,
  not_allowed: 'لا تملك صلاحية تعديل التزامات هذا المشروع، أو انتهت الجلسة. سجّل الدخول من جديد.',
  rejected: 'تعذّر حفظ الحركة. راجع البيانات وحاول مرة أخرى.',
  not_found: 'لم يُعثر على هذه الحركة. ربما حُذفت من قبل.',
  unavailable: 'تعذّر الاتصال الآن. تحقق من الاتصال وحاول مرة أخرى.',
};

/**
 * Foreign currency and the owner's reference rate (3.18, FR-FIN-04; decisions of 20 Nov 2026). No design screen: built
 * from S14.1's fields and styles. The wording says the rate is the owner's own, never an official or fetched one.
 */
export const currencyTextAr = {
  names: { USD: 'دولار أمريكي', EUR: 'يورو', TRY: 'ليرة تركية', CNY: 'يوان صيني' } satisfies Record<Currency, string>,
  section: 'دُفع بعملة أخرى',
  sectionOptional: 'اختياري',
  currency: 'العملة',
  currencyNone: 'بالدينار الليبي',
  originalAmount: (code: string) => `المبلغ بالعملة · ${code}`,
  rate: (code: string) => `سعر الصرف · د.ل لكل 1 ${code}`,
  rateHint: 'سعرك المرجعي: ما دفعته أو ما تعتمده أنت. لا يجلب النظام سعر الصرف ولا يتوقعه.',
  latest: (rate: string, date: string) => `آخر سعر في سجلك: ${rate} د.ل بتاريخ ${date}`,
  noLatest: 'لا سعر لهذه العملة في سجلك بعد.',
  equivalent: 'المبلغ بالدينار',
  equivalentHint: 'يُحسب من المبلغ بالعملة × سعر الصرف، ويدخل في كل المجاميع.',
  amountFromForeign: 'يُحسب من العملة الأخرى في آخر النموذج',
  /** A rate keeps 4 decimals, not the 3 of money: its own message for «invalid_number». */
  rateInvalid: 'اكتب سعرًا مثل 7.25، بأربع خانات عشرية على الأكثر.',
  /** «1,000 USD بسعر 7.25» (ForeignNote). */
  at: 'بسعر',

  // The log (decision of 20 Nov 2026)
  log: {
    pageTitle: 'أسعار الصرف المرجعية',
    title: 'أسعار الصرف المرجعية',
    subtitle: 'أسعارك أنت لكل عملة، بتاريخها',
    latestTitle: 'آخر سعر لكل عملة',
    perUnit: (code: string) => `د.ل لكل 1 ${code}`,
    history: 'كل الأسعار المسجلة',
    empty: 'لا أسعار صرف مسجلة بعد',
    emptyNote: 'سجّل السعر الذي تعتمده لكل عملة، فيبدأ به نموذج المصروف.',
    notice: 'لا يجلب النظام سعر الصرف ولا يتوقعه، وتغيير السعر هنا لا يغيّر مصروفًا سُجّل من قبل.',
    add: 'إضافة سعر صرف',
    added: 'حُفظ سعر الصرف.',
    deleted: 'حُذف سعر الصرف، وبقي أثره في سجل التدقيق.',
    delete: 'حذف',
    deleteLabel: (code: string, date: string) => `حذف سعر ${code} بتاريخ ${date}`,
    deleteConfirm: (code: string, date: string) => `حذف سعر ${code} بتاريخ ${date}؟ لا يتغير أي مصروف مسجل.`,
  },
  form: {
    pageTitle: 'إضافة سعر صرف',
    title: 'إضافة سعر صرف',
    subtitle: 'سعرك المرجعي لعملة واحدة',
    currency: 'العملة',
    currencyPlaceholder: 'اختر العملة',
    rate: 'د.ل لكل وحدة واحدة',
    date: 'التاريخ',
    note: 'ملاحظة',
    notePlaceholder: 'مثل: السوق الموازي، أو سعر المورد',
    optional: 'اختياري',
    submit: 'حفظ السعر',
    submitting: 'جارٍ الحفظ…',
  },
} as const;

/**
 * The budget screens. Wording from the design: S15.1 «ميزانية المشروع», S15.2 «توزيع الميزانية». FR-FIN-11's warning
 * uses D5 (10%, temporary). 3.16 financial part, slice 1 (20 Nov 2026).
 */
export const budgetTextAr = {
  back: 'رجوع',
  lyd: 'د.ل',
  overview: {
    pageTitle: 'ميزانية المشروع',
    title: 'ميزانية المشروع',
    subtitle: 'مقارنة الإنفاق بالمخصصات',
    remaining: 'المتبقي من الميزانية',
    approvedSpent: (approved: string, spent: string) => `المعتمد: ${approved} · المصروف: ${spent}`,
    overBudget: 'المصروف تجاوز الميزانية الإجمالية.',
    overPhases: (n: number) =>
      n === 1 ? 'مرحلة واحدة تجاوزت مخصصها بأكثر من 10%.' : `${n} مراحل تجاوزت مخصصاتها بأكثر من 10%.`,
    contingencyUsedUp: 'استُهلك بند الطوارئ بالأعمال الإضافية المعتمدة.',
    beyondBudget: (expected: string, beyond: string) => `التكلفة المتوقعة صارت ${expected} د.ل، أي فوق الميزانية بـ ${beyond} د.ل.`,
    rows: {
      phases: { title: 'تفصيل الميزانية حسب المراحل', note: 'مخصصات وإنفاق كل مرحلة', action: 'عرض' },
      extras: {
        title: 'الأعمال الإضافية والتغييرات',
        note: (approved: string, proposed: string) => `معتمدة ${approved} · مقترحة ${proposed} د.ل`,
        action: 'عرض',
      },
      cashflow: { title: 'الالتزامات والدخل', note: 'الدفعات القادمة ومصادر التمويل', action: 'عرض' },
      contracts: { title: 'العقود والدفعات', note: 'متابعة العقود والاستحقاقات', action: 'قريبًا' },
      decision: { title: 'الاستمرار أو التوقف', note: 'مراجعة السيناريو المالي', action: 'مراجعة' },
    },
  },
  phases: {
    pageTitle: 'توزيع الميزانية',
    title: 'توزيع الميزانية',
    subtitle: 'المخصصات حسب مراحل المشروع',
    allocated: (allocated: string, forPhases: string) => `الموزّع ${allocated} من ${forPhases} د.ل المتاحة للمراحل`,
    overAllocated: 'مجموع المخصصات أكبر من الميزانية بعد بند الطوارئ. هذا تنبيه، ويمكنك الإبقاء عليه.',
    noAllocation: 'بلا مخصص',
    spent: (amount: string) => `مصروف: ${amount} د.ل`,
    usedPct: (pct: number) => `${pct}% من المخصص`,
    notStarted: 'لم تبدأ',
    over: 'تجاوز المخصص بأكثر من 10%',
    contingency: 'احتياطي المشروع',
    contingencyNote: 'بند الطوارئ من الميزانية',
    contingencyUsed: (used: string, left: string) => `للأعمال الإضافية المعتمدة: ${used} د.ل · متبقٍ: ${left} د.ل`,
    unassigned: 'مصروفات بلا مرحلة',
    unassignedNote: 'سُجّلت دون ربطها بمرحلة',
    before: 'المصروف قبل التطبيق',
    beforeNote: 'لا يُوزَّع على المراحل',
    edit: 'تعديل التوزيع',
    backToBudget: 'العودة للميزانية',
    saved: 'حُفظ توزيع الميزانية.',
    deviationNote: 'التنبيه حين يزيد مصروف المرحلة على مخصصها بأكثر من 10%. هذه نسبة مؤقتة (القرار D5).',
  },
  form: {
    pageTitle: 'تعديل توزيع الميزانية',
    title: 'تعديل توزيع الميزانية',
    subtitle: 'مخصص كل مرحلة بالدينار',
    hint: (forPhases: string) => `المتاح للمراحل بعد بند الطوارئ: ${forPhases} د.ل. اترك الحقل فارغًا لمرحلة بلا مخصص.`,
    phaseLabel: (name: string) => `${name} · د.ل`,
    submit: 'حفظ التوزيع',
    submitting: 'جارٍ الحفظ…',
  },
} as const;

/**
 * Extra works and changes (FR-FIN-10; 3.16 financial part, slice 2; decisions of 20 Nov 2026). No design screen: built
 * from the design's list, card and form styles (change register).
 */
export const extrasTextAr = {
  back: 'رجوع',
  lyd: 'د.ل',
  list: {
    pageTitle: 'الأعمال الإضافية والتغييرات',
    title: 'الأعمال الإضافية والتغييرات',
    subtitle: 'ما زاد على الخطة، بقيمته وحالته',
    approved: 'الأعمال الإضافية المعتمدة',
    contingencyLeft: (left: string) => `تُخصم من بند الطوارئ أولًا · متبقٍ منه: ${left} د.ل`,
    proposed: (amount: string) => `مقترحة بانتظار قرارك: ${amount} د.ل (لا تُحسب بعد)`,
    empty: 'لا أعمال إضافية مسجلة',
    emptyNote: 'سجّل كل عمل خارج الخطة بقيمته، واعتمده أو ارفضه، لترى أثره على الميزانية.',
    add: 'إضافة عمل إضافي',
    added: 'حُفظ العمل الإضافي.',
    changed: 'حُدّثت حالة العمل الإضافي، وسُجّل التغيير في سجل التدقيق.',
    deleted: 'حُذف العمل الإضافي، وبقي أثره في سجل التدقيق.',
    approve: 'اعتماد',
    reject: 'رفض',
    delete: 'حذف',
    approveConfirm: (title: string, cost: string) => `اعتماد «${title}» بقيمة ${cost} د.ل؟ تُخصم من بند الطوارئ أولًا.`,
    rejectConfirm: (title: string) => `رفض «${title}»؟ لن يؤثر على الميزانية.`,
    deleteConfirm: (title: string) => `حذف «${title}»؟ تبقى قيمه في سجل التدقيق.`,
    actionLabel: (action: string, title: string) => `${action}: ${title}`,
  },
  status: { proposed: 'مقترحة', approved: 'معتمدة', rejected: 'مرفوضة' },
  form: {
    pageTitle: 'إضافة عمل إضافي',
    title: 'إضافة عمل إضافي',
    subtitle: 'عمل خارج الخطة أو تغيير فيها',
    titleLabel: 'الوصف',
    cost: 'القيمة · د.ل',
    date: 'التاريخ',
    phase: 'المرحلة',
    noPhase: 'غير مرتبط بمرحلة',
    status: 'الحالة',
    note: 'ملاحظة',
    optional: 'اختياري',
    submit: 'حفظ العمل',
    submitting: 'جارٍ الحفظ…',
  },
} as const;
