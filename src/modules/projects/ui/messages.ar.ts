import type { SetupErrorCode, SetupField } from '../domain/project-setup';

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
      'مشروع إضافة طابق: قبل بدء العمل يجب أن يقيّم مهندس إنشائي قدرة المبنى الحالي على تحمّل الطابق الجديد. النظام ينبّه ولا يعتمد السلامة.',
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
