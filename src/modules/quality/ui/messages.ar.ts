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
    submit: 'حفظ والعودة للقائمة',
    submitting: 'جارٍ الحفظ…',
  },
} as const;

export const checklistErrorsAr: Record<CheckErrorCode, string> = {
  required: 'هذا الحقل مطلوب.',
  too_short: 'النص قصير جدًا.',
  too_long: 'النص طويل جدًا.',
  unknown_choice: 'اختر من القائمة.',
  invalid_date: 'التاريخ غير صحيح.',
  invalid_reference: 'اختر من القائمة.',
};

export const checklistFailedAr: Record<ChecklistFailure | 'no_project', string> = {
  not_allowed: 'لا تملك صلاحية التعديل في هذا المشروع، أو انتهت الجلسة. سجّل الدخول من جديد.',
  unknown_reference: 'لم يُعثر على المرحلة أو القالب في هذا المشروع.',
  rejected: 'تعذّر الحفظ. راجع البيانات وحاول مرة أخرى.',
  not_found: 'لم يُعثر على هذا البند. ربما حُذف من قبل.',
  unavailable: 'تعذّر الاتصال الآن. تحقق من الاتصال وحاول مرة أخرى.',
  no_project: 'لا يوجد مشروع بعد. أنشئ مشروعك أولًا.',
};
