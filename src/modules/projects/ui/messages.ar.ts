import type { SetupErrorCode, SetupField } from '../domain/project-setup';
import type { NewTaskErrorCode, TaskStatus } from '../domain/tasks';
import type { TaskFailure } from '../application/tasks';
import type { PhaseStatus } from '../domain/phase-plan';
import type { PhaseScheduleErrorCode } from '../domain/phase-schedule';

// Arabic text for the first-project wizard and the project summary.
// Design: teammate's v2 screens S02.1, S02.2, S02.3, S02.5 (S02.4 "project team" deferred, decision 14 Nov).

export const wizardTextAr = {
  back: 'رجوع',
  stepOf: (step: number, total: number) => `الخطوة ${step} من ${total}`,
  progress: (pct: number) => `الإنجاز ${pct}%`,
  requiredHint: 'الحقول المميزة بـ * مطلوبة.',

  details: {
    title: 'بيانات المشروع',
    subtitle: 'إعداد مشروعك الأول',
    name: 'اسم المشروع',
    city: 'المدينة',
    cityPlaceholder: 'اختر المدينة',
    cityOther: 'أخرى',
    otherCity: 'اسم المدينة',
    projectType: 'نوع المشروع',
    typeNew: 'بناء جديد',
    typeAddFloor: 'إضافة طابق',
    area: 'مساحة البناء · م²',
    areaHelper: 'مجموع مساحة كل الطوابق التي ستُبنى. في إضافة طابق: مساحة الطابق الجديد فقط.',
    next: 'التالي: خطة المراحل',
  },

  phases: {
    title: 'خطة المراحل',
    subtitle: 'اختر المرحلة التي وصلت إليها',
    done: 'مكتملة',
    notFinished: 'لم تكتمل',
    // Solution B (16 Nov): earlier phases start as finished; the owner unticks the ones that are not.
    earlierTitle: 'المراحل السابقة',
    earlierHelper: 'أزل العلامة عن أي مرحلة لم تكتمل بعد.',
    finishedCheck: (name: string) => `اكتملت مرحلة «${name}»`,
    current: 'الحالية',
    later: 'لاحقًا',
    unreviewedNote: 'قائمة المراحل مقترحة ولم يراجعها مهندس بعد. يمكنك تعديل الأسماء والترتيب لاحقًا.',
    chooseCurrent: 'اختر المرحلة الحالية.',
    next: 'التالي: الميزانية',
  },

  budget: {
    title: 'ميزانية المشروع',
    subtitle: 'تقدير أولي قابل للتعديل',
    total: 'الميزانية الإجمالية · د.ل',
    availableNow: 'المبلغ المتاح حاليًا · د.ل',
    availableHelper: 'ما لديك الآن من مال للمشروع. يُحفظ بتاريخ اليوم، وتحدّثه أنت متى شئت.',
    spentBefore: 'المصروف قبل استخدام التطبيق · د.ل',
    contingency: 'نسبة الطوارئ %',
    contingencyHelper: 'مبلغ احتياطي من الميزانية للمفاجآت. 10% اقتراح يمكنك تغييره، وليست قاعدة هندسية.',
    overBudget: 'المصروف السابق أكبر من الميزانية الإجمالية. يمكنك المتابعة، وستُطلب منك الموافقة في الخطوة الأخيرة.',
    next: 'التالي: مراجعة الإعداد',
  },

  review: {
    title: 'مشروعك جاهز',
    subtitle: 'راجع التفاصيل',
    projectName: 'اسم المشروع',
    area: (m2: string) => `${m2} م²`,
    currentPhase: 'المرحلة الحالية',
    phaseOf: (pos: number, total: number) => `${pos} من ${total}`,
    totalBudget: 'الميزانية الإجمالية',
    inLyd: 'بالدينار الليبي',
    spentBefore: 'المصروف السابق',
    team: 'فريق المشروع',
    teamLater: 'يمكن إضافة الأعضاء لاحقًا',
    teamOwner: 'مالك',
    // FR-PRJ-02. Warning text; to be reviewed by the project's engineer (engineering content).
    addFloorWarning:
      'مشروع إضافة طابق: قبل بدء أعمال الطابق الجديد يجب أن يقيّم مهندس إنشائي قدرة المبنى الحالي على تحمّله. هذا تنبيه، ويمكنك إنشاء المشروع الآن. النظام ينبّه ولا يعتمد السلامة.',
    overBudgetConfirm: 'أؤكد أن المصروف السابق أكبر من الميزانية الإجمالية، وأريد المتابعة.',
    overBudgetNeeded: 'المصروف السابق أكبر من الميزانية. أكّد المتابعة أولًا.',
    create: 'فتح لوحة المشروع',
    creating: 'جارٍ إنشاء المشروع…',
    edit: 'تعديل البيانات',
    incomplete: 'بعض البيانات ناقصة. راجع الخطوات السابقة.',
  },
} as const;

export const setupErrorsAr: Record<SetupErrorCode, string> = {
  required: 'هذا الحقل مطلوب.',
  too_short: 'النص قصير جدًا.',
  too_long: 'النص طويل جدًا.',
  invalid_number: 'اكتب رقمًا صحيحًا، مثل 450,000 أو 240.5',
  must_be_positive: 'يجب أن يكون أكبر من صفر.',
  percent_out_of_range: 'النسبة بين 0 و100، برقمين عشريين على الأكثر.',
  too_large: 'الرقم كبير جدًا.',
  unknown_choice: 'اختر من القائمة.',
};

export const createFailedAr = {
  already_has_project: 'لديك مشروع من قبل. سننقلك إليه.',
  not_signed_in: 'انتهت الجلسة. سجّل الدخول من جديد.',
  unavailable: 'تعذّر إنشاء المشروع. حاول مرة أخرى.',
} as const;

export type SetupFieldErrors = Partial<Record<SetupField, string>>;

// ---------------------------------------------------------------------------------------------------------------
// Phases screen (FR-PRJ-03). Design: S09.1 «مراحل المشروع». Status words from the design (S09.1, S02.2).


export const phaseStatusAr: Record<PhaseStatus, string> = {
  not_started: 'لم تبدأ',
  in_progress: 'قيد التنفيذ',
  closing: 'قيد الإغلاق',
  done: 'مكتملة',
  blocked: 'معلقة',
};

/**
 * "3 أيام", with Arabic number agreement (Intl plural categories for Arabic):
 * 1 one, 2 two, 3–10 few, 11–99 many, 100+ other.
 */
const arPlural = new Intl.PluralRules('ar');
export function daysAr(n: number): string {
  switch (arPlural.select(n)) {
    case 'one':
      return 'يوم واحد';
    case 'two':
      return 'يومان';
    case 'few':
      return `${n} أيام`;
    case 'many':
      return `${n} يومًا`;
    default:
      return `${n} يوم`;
  }
}

export const phasesTextAr = {
  pageTitle: 'مراحل المشروع',
  title: 'مراحل المشروع',
  back: 'رجوع',
  subtitle: (project: string, current: string | null) => (current ? `${project} · المرحلة الحالية: ${current}` : project),
  doneCard: 'المراحل المكتملة',
  doneOf: (done: number, total: number) => `${done} من ${total}`,
  lateCount: (n: number) => (n === 0 ? 'لا مراحل متأخرة' : n === 1 ? 'مرحلة واحدة متأخرة' : n === 2 ? 'مرحلتان متأخرتان' : `${n} مراحل متأخرة`),
  current: 'المرحلة الحالية',
  planned: (from: string | null, to: string | null) =>
    from && to ? `المخطط: ${from} – ${to}` : from ? `البدء المخطط: ${from}` : to ? `الانتهاء المخطط: ${to}` : 'بلا تواريخ مخططة',
  // Delay (FR-PRJ-03: the difference between planned and actual dates).
  delay: {
    unknown: '—',
    onTime: 'في الموعد',
    lateNow: (days: string) => `متأخرة · ${days}`,
    lateDone: (days: string) => `تأخرت · ${days}`,
    early: (days: string) => `مبكرة · ${days}`,
  },
  edit: 'تعديل',
  note: 'التأخير هو الفرق بين التاريخ المخطط والفعلي. أضف التواريخ من «تعديل» لكل مرحلة.',

  form: {
    subtitle: 'الحالة والتواريخ',
    status: 'حالة المرحلة',
    plannedStart: 'بداية مخططة',
    plannedEnd: 'نهاية مخططة',
    actualStart: 'بداية فعلية',
    actualEnd: 'نهاية فعلية',
    plannedTitle: 'المخطط',
    actualTitle: 'الفعلي',
    actualHelper: 'ما حدث فعلًا، فلا يكون بعد اليوم.',
    closingNote: 'إنهاء المرحلة بقائمة تسليم يأتي لاحقًا. الآن تكفي الحالة «مكتملة».',
    save: 'حفظ',
    saving: 'جارٍ الحفظ…',
  },
} as const;

export const phaseScheduleErrorsAr: Record<PhaseScheduleErrorCode, string> = {
  unknown_status: 'اختر حالة من القائمة.',
  invalid_date: 'التاريخ غير صحيح.',
  end_before_start: 'النهاية لا تكون قبل البداية.',
  date_in_future: 'التاريخ الفعلي لا يكون بعد اليوم.',
};

export const phaseUpdateFailedAr = {
  not_allowed: 'لا تملك صلاحية تعديل هذه المرحلة، أو انتهت الجلسة.',
  rejected: 'رُفضت القيم. راجع التواريخ والحالة.',
  unavailable: 'تعذّر الحفظ. حاول مرة أخرى.',
} as const;

// ---------------------------------------------------------------------------------------------------------------
// Phase page and its tasks (FR-PRJ-04). Design: S10.1 (phase overview), S10.2 «مهام المرحلة».

export const taskStatusAr: Record<TaskStatus, string> = {
  todo: 'مجدولة',
  doing: 'قيد التنفيذ',
  done: 'منجزة',
};

/** The button that moves a task on: start it, finish it, reopen it. */
export const taskActionAr: Record<TaskStatus, string> = {
  todo: 'بدء',
  doing: 'إنجاز',
  done: 'إعادة فتح',
};

/** "3 مهام", with Arabic number agreement. */
export function tasksCountAr(n: number): string {
  switch (arPlural.select(n)) {
    case 'zero':
      return 'لا مهام';
    case 'one':
      return 'مهمة واحدة';
    case 'two':
      return 'مهمتان';
    case 'few':
      return `${n} مهام`;
    case 'many':
      return `${n} مهمة`;
    default:
      return `${n} مهمة`;
  }
}

export const phasePageTextAr = {
  back: 'رجوع',
  subtitle: 'نظرة عامة',
  progressCard: 'نسبة إنجاز المرحلة',
  progressOf: (done: number, total: string) => `${done} من ${total} منجزة`,
  noTasks: 'لا مهام بعد. أضف مهام المرحلة لتُحسب نسبة إنجازها.',
  scheduleRow: 'الحالة والتواريخ',
  tasksTitle: 'مهام المرحلة',
  due: (date: string) => `الموعد: ${date}`,
  overdue: 'متأخرة',
  delete: 'حذف',
  deleteConfirm: (title: string) => `حذف المهمة «${title}»؟ لا يمكن التراجع.`,
  addTitle: 'مهمة جديدة',
  taskTitle: 'عنوان المهمة',
  dueDate: 'الموعد',
  add: 'إضافة مهمة',
  adding: 'جارٍ الإضافة…',
  progressInList: (pct: number, done: number, total: string) => `الإنجاز ${pct}% · ${done} من ${total}`,
} as const;

export const newTaskErrorsAr: Record<NewTaskErrorCode, string> = {
  required: 'اكتب عنوان المهمة.',
  too_short: 'العنوان قصير جدًا.',
  too_long: 'العنوان طويل جدًا (120 حرفًا على الأكثر).',
  invalid_date: 'التاريخ غير صحيح.',
};

export const taskFailedAr: Record<TaskFailure, string> = {
  not_allowed: 'لا تملك صلاحية تعديل مهام هذه المرحلة، أو انتهت الجلسة.',
  unknown_reference: 'هذه المرحلة ليست من مشروعك.',
  rejected: 'رُفضت القيم. راجع العنوان والتاريخ.',
  unavailable: 'تعذّر الحفظ. حاول مرة أخرى.',
};
