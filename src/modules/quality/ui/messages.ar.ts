import type { CheckErrorCode, CheckResult } from '../domain/checklist';
import type { ChecklistFailure } from '../application/checklists';

// Arabic text for the pre-pour checkpoints. Wording from the design: S26.1 «قائمة الفحص», S26.2 «تفاصيل بند الفحص».
// The design's «معتمد» for a sound item is not used: only the engineer approves; the owner records «سليم» (FR-SYS-05).

/** FR-SYS-05: every technical screen says the system documents and does not replace the engineer. */
export const ENGINEER_NOTE_AR = 'يوثّق النظام الفحص ولا يحل محل المهندس المسؤول.';

export const checklistTextAr = {
  back: 'رجوع',
  optional: 'اختياري',
  requiredHint: 'الحقول المميزة بـ * مطلوبة.',
  engineerNote: ENGINEER_NOTE_AR,
  unreviewed: 'قالب غير مراجَع من مهندس',
  approvedBy: 'قالب مراجَع',

  /** Stop plan (3.14): a measure is ready, needs work, or does not apply. */
  stopPlanResult: {
    ok: 'جاهز',
    issue: 'يحتاج عمل',
    na: 'لا ينطبق',
    none: 'لم يُراجَع',
  } satisfies Record<CheckResult | 'none', string>,

  /** Readiness (3.15): an item is there or missing, not «سليم». */
  readinessResult: {
    ok: 'متوفر',
    issue: 'ناقص',
    na: 'لا ينطبق',
    none: 'لم يُراجَع',
  } satisfies Record<CheckResult | 'none', string>,

  result: {
    ok: 'سليم',
    issue: 'توجد ملاحظة',
    na: 'لا ينطبق',
    none: 'لم يُفحص',
  } satisfies Record<CheckResult | 'none', string>,

  phaseLink: {
    title: 'قوائم الفحص',
    none: 'لا قوائم بعد',
    count: (n: number, open: number) =>
      `${n === 1 ? 'قائمة واحدة' : n === 2 ? 'قائمتان' : `${n} قوائم`}${open > 0 ? ` · ${open === 1 ? 'واحدة مفتوحة' : `${open} مفتوحة`}` : ' · مكتملة'}`,
  },

  phase: {
    pageTitle: 'قوائم الفحص',
    title: 'قوائم الفحص',
    subtitle: (phase: string) => `${phase} · قبل الصب والتغطية`,
    empty: 'لا قوائم فحص لهذه المرحلة بعد',
    emptyNote: 'أنشئ قائمة لكل صبة، مثل «صب سقف الدور الأرضي»، وسجّل نتيجة كل بند قبل الصب.',
    progress: (checked: number, total: number) => `${checked} من ${total} بندًا`,
    issues: (n: number) => (n === 1 ? 'ملاحظة واحدة' : `${n} ملاحظات`),
    completed: 'مكتملة',
    open: (title: string) => `فتح قائمة ${title}`,
    add: 'إضافة قائمة فحص',
  },

  form: {
    pageTitle: 'إضافة قائمة فحص',
    title: 'إضافة قائمة فحص',
    subtitle: (phase: string) => phase,
    name: 'اسم القائمة',
    nameHint: 'مثل: صب سقف الدور الأرضي',
    template: 'القالب',
    templateNote: (n: number) => `${n} بنود`,
    submit: 'إنشاء القائمة',
    submitting: 'جارٍ الإنشاء…',
  },

  list: {
    subtitle: (phase: string, checked: number, total: number) => `${phase} · ${checked} من ${total} بندًا`,
    itemsLabel: 'بنود الفحص',
    open: (text: string) => `فحص: ${text}`,
    issuesCount: (n: number) => (n === 1 ? 'بند واحد عليه ملاحظة.' : `${n} بنود عليها ملاحظات.`),
    completed: 'اكتملت القائمة: لكل بند نتيجة.',
    created: 'أُنشئت القائمة من القالب.',
    saved: 'حُفظت نتيجة البند.',
    backToPhase: 'العودة إلى المرحلة',
    recheck: (date: string) => `إعادة الفحص ${date}`,
    needsPhoto: 'يتطلب صورة',
    hasPhoto: 'صورة مرفقة',
  },

  item: {
    pageTitle: 'تفاصيل بند الفحص',
    title: 'تفاصيل بند الفحص',
    result: 'نتيجة الفحص',
    note: 'ملاحظة',
    responsible: 'المسؤول عن المعالجة',
    responsibleHint: 'مثل: مقاول الهيكل',
    recheckOn: 'موعد إعادة الفحص',
    lastChecked: (date: string) => `آخر تسجيل: ${date}`,
    photo: 'صورة البند',
    photoRequired: 'مطلوبة لتسجيل «سليم»',
    photoCurrent: 'الصورة المحفوظة',
    photoPick: 'التقط صورة أو اخترها',
    photoChange: 'استبدال الصورة',
    photoRemove: 'إلغاء الصورة الجديدة',
    photoPreparing: 'جارٍ تجهيز الصورة…',
    photoConverting: 'جارٍ تحويل صورة الآيفون (HEIC)…',
    photoUploading: 'جارٍ رفع الصورة…',
    photoNotImage: 'هذا الملف ليس صورة.',
    photoTooLarge: 'الصورة كبيرة جدًا (30 ميغابايت على الأكثر).',
    photoUnreadable: 'تعذّرت قراءة الصورة. جرّب صورة أخرى.',
    photoHeicFailed: 'تعذّر تحويل صورة HEIC في هذا المتصفح. أرسلها بصيغة JPEG أو جرّب متصفحًا آخر.',
    photoUploadFailed: 'تعذّر رفع الصورة. تحقق من الاتصال وحاول مرة أخرى.',
    submit: 'حفظ والعودة للقائمة',
    submitting: 'جارٍ الحفظ…',
    cost: 'التكلفة التقديرية · د.ل',
    costHint: 'من عرض سعر أو تقدير المقاول. لا يقترح النظام أرقامًا؛ تدخل في «الحماية» بسيناريو التوقف.',
  },
} as const;

export const checklistErrorsAr: Record<CheckErrorCode, string> = {
  required: 'هذا الحقل مطلوب.',
  too_short: 'النص قصير جدًا.',
  too_long: 'النص طويل جدًا.',
  unknown_choice: 'اختر من القائمة.',
  invalid_date: 'التاريخ غير صحيح.',
  invalid_reference: 'اختر من القائمة.',
  photo_required: 'هذا البند يتطلب صورة ليُسجَّل «سليم». أرفق صورة، أو سجّل «توجد ملاحظة».',
  invalid_number: 'اكتب مبلغًا صحيحًا بثلاث خانات عشرية على الأكثر، مثل 1,200 أو 350.5',
  too_large: 'المبلغ كبير جدًا.',
  must_be_positive: 'المبلغ لا يكون سالبًا.',
};

export const checklistFailedAr: Record<ChecklistFailure | 'no_project', string> = {
  not_allowed: 'لا تملك صلاحية التعديل في هذا المشروع، أو انتهت الجلسة. سجّل الدخول من جديد.',
  unknown_reference: 'لم يُعثر على المرحلة أو القالب في هذا المشروع.',
  rejected: 'تعذّر الحفظ. راجع البيانات وحاول مرة أخرى.',
  not_found: 'لم يُعثر على هذا البند. ربما حُذف من قبل.',
  photo_missing: 'لم تصل الصورة. حاول مرة أخرى.',
  unavailable: 'تعذّر الاتصال الآن. تحقق من الاتصال وحاول مرة أخرى.',
  no_project: 'لا يوجد مشروع بعد. أنشئ مشروعك أولًا.',
};

// The project's readiness list (3.15; FR-PRJ-05). No design screen of its own: the design's S11.1 «بوابة الجاهزية» is a
// per-phase list; the owner chose one list per project (change register), built from the same pieces.
export const readinessTextAr = {
  pageTitle: 'جاهزية المشروع',
  title: 'جاهزية المشروع',
  subtitle: 'قبل بدء التنفيذ',
  progress: (checked: number, total: number) => `${checked} من ${total} بندًا روجع`,
  empty: 'لم تُنشأ قائمة الجاهزية بعد',
  emptyNote: 'قائمة بما يلزم قبل البدء: فحص التربة، والمخططات المعتمدة، والترخيص، والمهندس المشرف، وعقد المقاول.',
  addFloorNote: 'مشروع إضافة طابق: القائمة تضم التقييم الإنشائي للمبنى القائم قبل أي تنفيذ.',
  create: 'إنشاء قائمة الجاهزية',
  gapsCount: (n: number) => (n === 1 ? 'بند واحد ناقص أو لم يُراجَع.' : `${n} بنود ناقصة أو لم تُراجَع.`),
  ready: 'كل البنود متوفرة أو لا تنطبق.',
  gateNote: 'بدء مرحلة مع نقص ممكن، لكن يُطلب منك تأكيد صريح يُسجَّل.',
  saved: 'حُفظ البند.',
  /** For the gate on starting a phase: one line per gap. */
  gap: (text: string, state: 'missing' | 'unchecked') => `${text} (${state === 'missing' ? 'ناقص' : 'لم يُراجَع'})`,
  notCreated: 'قائمة جاهزية المشروع لم تُنشأ بعد',
  dashboard: {
    title: 'جاهزية المشروع',
    none: 'لم تُنشأ بعد',
    gaps: (n: number) => (n === 1 ? 'بند واحد ناقص' : `${n} بنود ناقصة`),
    ready: 'جاهز',
  },
} as const;

// A phase's stop plan (3.14; FR-DEC-04; design S19.1 «نقاط التوقف الآمنة»).
export const stopPlanTextAr = {
  pageTitle: 'نقاط التوقف الآمنة',
  title: 'نقاط التوقف الآمنة',
  subtitle: (phase: string) => `خطة توقف مقترحة · ${phase}`,
  engineerDecides: 'يحدد المهندس نقطة التوقف المناسبة',
  /** Design S19.1, word for word. */
  disclaimer: 'التطبيق لا يقرر سلامة التوقف تلقائيًا؛ يعتمد القرار على تقييم المهندس للموقع.',
  empty: 'لا خطة توقف لهذه المرحلة بعد',
  emptyNote: 'خطة بما يلزم إن توقف العمل في هذه المرحلة: حدود الأعمال المنجزة، وحماية الحديد والأسطح، والتدعيم، والتصريف، وخطة الاستئناف.',
  create: 'إنشاء خطة التوقف',
  progress: (checked: number, total: number) => `${checked} من ${total} بندًا روجع`,
  protectionTotal: 'مجموع تكاليف الحماية المقدّرة',
  protectionNone: 'لم تُدخل تكاليف بعد',
  protectionNote: 'من تقديراتك لكل إجراء؛ يدخل «الحماية» في سيناريو التوقف.',
  toScenario: 'فتح أرقام سيناريو التوقف',
  saved: 'حُفظ البند.',
  costOf: (amount: string) => `${amount} د.ل`,
  phaseLink: {
    title: 'نقاط التوقف الآمنة',
    none: 'لا خطة بعد',
    plan: (checked: number, total: number) => `${checked} من ${total} بندًا`,
  },
} as const;
