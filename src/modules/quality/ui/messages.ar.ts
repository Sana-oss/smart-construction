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
    linkIssue: 'تسجيل عيب مرتبط',
    linkIssueNote: 'ربط الملاحظة بسجل العيوب لمتابعتها حتى تُغلق',
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

// The defects list (3.17; FR-QLT-06, FR-QLT-07). Wording from the design: S28.1 «سجل العيوب», S28.2 «تسجيل عيب»,
// S28.3 «متابعة العيب». The design's «إغلاق العيب يتطلب اعتماد المهندس» is kept as advice: there are no engineer
// accounts, so the owner closes it.
export const issueTextAr = {
  back: 'رجوع',
  optional: 'اختياري',
  requiredHint: 'الحقول المميزة بـ * مطلوبة.',
  status: { open: 'مفتوح', in_progress: 'قيد المعالجة', closed: 'مغلق' },
  severity: { minor: 'منخفضة', major: 'متوسطة', critical: 'عالية' },

  list: {
    pageTitle: 'سجل العيوب',
    title: 'سجل العيوب',
    subtitleAll: (open: number) => `المشروع · ${openCountAr(open)}`,
    subtitlePhase: (phase: string, open: number) => `${phase} · ${openCountAr(open)}`,
    empty: 'لا عيوب مسجلة',
    emptyNote: 'سجّل كل عيب أو ملاحظة بصورته وموقعه والمسؤول عن معالجته، وتابعه حتى يُغلق.',
    priorityNote: 'تصنيف الأولوية توضيحي ويحدده المهندس بعد المعاينة.',
    row: (status: string, responsible: string | null, date: string) => [status, responsible, date].filter(Boolean).join(' · '),
    open: (title: string) => `متابعة: ${title}`,
    add: 'تسجيل عيب',
    added: 'سُجّل العيب.',
  },

  form: {
    pageTitle: 'تسجيل عيب',
    title: 'تسجيل عيب',
    subtitle: 'ملاحظة جديدة مرتبطة بالمرحلة',
    fromCheck: (item: string) => `من بند الفحص «${item}»`,
    titleLabel: 'عنوان الملاحظة',
    location: 'الموقع',
    locationHint: 'مثل: الدور الأرضي · المحور ب',
    description: 'الوصف',
    responsible: 'المسؤول',
    responsibleHint: 'مثل: مقاول الهيكل',
    severity: 'الأولوية',
    severityHint: 'توضيحية؛ يحددها المهندس بعد المعاينة.',
    phase: 'المرحلة',
    noPhase: 'بلا مرحلة',
    dueOn: 'موعد المعالجة',
    photo: 'صورة العيب',
    submit: 'حفظ الملاحظة',
    submitting: 'جارٍ الحفظ…',
  },

  detail: {
    pageTitle: 'متابعة العيب',
    title: 'متابعة العيب',
    statusLabel: 'الحالة',
    responsible: (who: string) => `المسؤول: ${who}`,
    location: 'الموقع',
    description: 'الوصف',
    due: 'موعد المعالجة',
    phase: 'المرحلة',
    timeline: 'المتابعة',
    created: 'تسجيل الملاحظة',
    started: 'بدء المعالجة',
    closed: 'إغلاق العيب',
    toInProgress: 'بدء المعالجة',
    toClosed: 'إغلاق العيب',
    reopen: 'إعادة فتح العيب',
    closeConfirm: 'إغلاق هذا العيب؟ يُنصح بإغلاقه بعد مراجعة المهندس.',
    reopenConfirm: 'إعادة فتح هذا العيب؟',
    engineerAdvice: 'إغلاق العيب يُفضَّل أن يكون بعد اعتماد المهندس.',
    photo: 'الصورة',
    photoAdd: 'إضافة صورة',
    photoReplace: 'استبدال الصورة',
    photoSave: 'حفظ الصورة',
    changed: 'حُدّثت حالة العيب.',
    photoSaved: 'حُفظت الصورة.',
    backToList: 'العودة لسجل العيوب',
  },

  /** For the warning when a phase is finished (FR-QLT-07), one line per open defect. */
  gapLine: (title: string, status: 'open' | 'in_progress') => `${title} (${status === 'open' ? 'مفتوح' : 'قيد المعالجة'})`,
  dashboard: { title: 'سجل العيوب', note: 'العيوب والملاحظات حتى الإغلاق', none: 'لا عيوب مفتوحة' },
  phaseLink: { title: 'سجل العيوب' },
} as const;

export function openCountAr(n: number): string {
  if (n === 0) return 'لا عيوب مفتوحة';
  if (n === 1) return 'عيب واحد مفتوح';
  if (n === 2) return 'عيبان مفتوحان';
  return n <= 10 ? `${n} عيوب مفتوحة` : `${n} عيبًا مفتوحًا`;
}

export const issueErrorsAr = {
  required: 'هذا الحقل مطلوب.',
  too_short: 'النص قصير جدًا.',
  too_long: 'النص طويل جدًا.',
  unknown_choice: 'اختر من القائمة.',
  invalid_date: 'التاريخ غير صحيح.',
  invalid_reference: 'اختر من القائمة.',
} as const;

export const issueFailedAr = {
  not_allowed: 'لا تملك صلاحية التعديل في هذا المشروع، أو انتهت الجلسة. سجّل الدخول من جديد.',
  unknown_reference: 'لم يُعثر على المرحلة أو القائمة في هذا المشروع.',
  rejected: 'تعذّر الحفظ. راجع البيانات وحاول مرة أخرى.',
  not_found: 'لم يُعثر على هذا العيب. ربما حُذف من قبل.',
  photo_missing: 'لم تصل الصورة. حاول مرة أخرى.',
  unavailable: 'تعذّر الاتصال الآن. تحقق من الاتصال وحاول مرة أخرى.',
  no_project: 'لا يوجد مشروع بعد. أنشئ مشروعك أولًا.',
} as const;

// The concrete log (3.13; FR-QLT-04, FR-QLT-05). Wording from the design: S27.1 «سجل الخرسانة», S27.2 «تسجيل صبة».
// Curing and formwork dates are the engineer's, copied by the owner: the app suggests no number of days.
export const concreteTextAr = {
  back: 'رجوع',
  optional: 'اختياري',
  requiredHint: 'الحقول المميزة بـ * مطلوبة.',
  m3: 'م³',

  log: {
    pageTitle: 'سجل الخرسانة',
    title: 'سجل الخرسانة',
    subtitleAll: 'المشروع · سجل التوريد والصب',
    subtitlePhase: (phase: string) => `${phase} · سجل التوريد والصب`,
    total: 'إجمالي الكمية المسجلة',
    count: (n: number) => (n === 0 ? 'لا صبات بعد' : n === 1 ? 'صبة واحدة موثقة' : n === 2 ? 'صبّتان موثقتان' : `${n} صبات موثقة`),
    row: (date: string, supplier: string) => `${date} · المورد: ${supplier}`,
    empty: 'لا صبات مسجلة',
    emptyNote: 'سجّل كل صبة: العنصر والتاريخ والمورد والكمية وعينات المكعبات، ومواعيد المعالجة وفك الشدات كما يحددها المهندس.',
    reminders: 'تذكيرات',
    open: (element: string) => `تفاصيل ${element}`,
    add: 'تسجيل صبة جديدة',
    added: 'حُفظت الصبة.',
    deleted: 'حُذفت الصبة، وبقي أثرها في سجل التدقيق.',
  },

  reminder: {
    curing: (element: string) => `آخر يوم لمعالجة «${element}» بالماء`,
    formwork: (element: string) => `فك شدات «${element}»`,
    when: (days: number) => (days < 0 ? (days === -1 ? 'متأخر يومًا' : `متأخر ${-days} أيام`) : days === 0 ? 'اليوم' : days === 1 ? 'غدًا' : `بعد ${days} أيام`),
    note: 'المواعيد كما حددها المهندس؛ لا يقترح النظام مددًا.',
  },

  form: {
    pageTitle: 'تسجيل صبة',
    title: 'تسجيل صبة',
    subtitle: 'توثيق بيانات التوريد والتنفيذ',
    element: 'عنصر الصب',
    elementHint: 'مثل: سقف الدور الأرضي',
    pouredOn: 'تاريخ الصب',
    supplier: 'المورد',
    qtyM3: 'الكمية الفعلية · م³',
    cubeSamples: 'عدد عينات المكعبات',
    mixRef: 'مرجع الخلطة المعتمدة',
    mixRefHint: 'مثل: حسب مستند المشروع',
    deliveryRef: 'رقم إذن التوريد',
    phase: 'المرحلة',
    noPhase: 'بلا مرحلة',
    engineerGroup: 'مواعيد يحددها المهندس',
    curingUntil: 'آخر يوم للمعالجة بالماء',
    formworkOn: 'موعد فك الشدات',
    engineerHint: 'انسخها من تعليمات المهندس؛ النظام لا يقترح مددًا، ويذكّرك قبلها بيومين.',
    note: 'ملاحظات',
    docsNote: 'تُرفق نتائج الاختبارات والمستندات في وثائق المرحلة.',
    submit: 'حفظ السجل',
    submitting: 'جارٍ الحفظ…',
  },

  detail: {
    pageTitle: 'تفاصيل الصبة',
    pouredOn: 'تاريخ الصب',
    supplier: 'المورد',
    qty: 'الكمية',
    cubes: 'عينات المكعبات',
    mixRef: 'مرجع الخلطة',
    deliveryRef: 'إذن التوريد',
    phase: 'المرحلة',
    note: 'ملاحظات',
    curing: 'المعالجة بالماء حتى',
    formwork: 'فك الشدات',
    done: 'تمّ',
    undo: 'إلغاء «تمّ»',
    doneAt: (date: string) => `تمّ ${date}`,
    noDate: 'لم يُحدَّد',
    delete: 'حذف الصبة',
    deleteConfirm: 'حذف هذه الصبة؟ يبقى أثرها في سجل التدقيق.',
    changed: 'حُدّث التذكير.',
  },

  dashboard: { title: 'سجل الخرسانة', reminders: (n: number) => (n === 1 ? 'تذكير واحد' : `${n} تذكيرات`), none: 'لا تذكيرات' },
  phaseLink: { title: 'سجل الخرسانة' },
} as const;

export const pourErrorsAr = {
  required: 'هذا الحقل مطلوب.',
  too_short: 'النص قصير جدًا.',
  too_long: 'النص طويل جدًا.',
  invalid_number: 'اكتب رقمًا صحيحًا، مثل 30 أو 12.5',
  must_be_positive: 'يجب أن تكون الكمية أكبر من صفر.',
  too_large: 'الرقم كبير جدًا.',
  too_many_decimals: 'ثلاث خانات عشرية على الأكثر.',
  must_be_whole: 'اكتب عددًا صحيحًا.',
  invalid_date: 'التاريخ غير صحيح.',
  date_in_future: 'تاريخ الصب لا يكون بعد اليوم.',
  before_pour: 'هذا الموعد لا يكون قبل تاريخ الصب.',
  invalid_reference: 'اختر من القائمة.',
} as const;

export const pourFailedAr = {
  not_allowed: 'لا تملك صلاحية التعديل في هذا المشروع، أو انتهت الجلسة. سجّل الدخول من جديد.',
  unknown_reference: 'لم يُعثر على المرحلة في هذا المشروع.',
  rejected: 'تعذّر الحفظ. راجع البيانات وحاول مرة أخرى.',
  not_found: 'لم يُعثر على هذه الصبة. ربما حُذفت من قبل.',
  unavailable: 'تعذّر الاتصال الآن. تحقق من الاتصال وحاول مرة أخرى.',
  no_project: 'لا يوجد مشروع بعد. أنشئ مشروعك أولًا.',
} as const;
