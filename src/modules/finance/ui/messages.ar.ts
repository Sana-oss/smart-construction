import type { ExpenseFailure } from '../application/expense-gateway';
import type { ExpenseErrorCode, ExpenseField, ExpenseType } from '../domain/expense';

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
  },

  saved: {
    title: 'تم حفظ المصروف',
    // Shown when the same request reached the server twice (weak connection, double tap): NFR-REL-01.
    duplicate: 'هذا المصروف محفوظ من قبل، ولم يُسجَّل مرة ثانية.',
    payee: 'المورد',
    noPayee: 'غير محدد',
    status: 'حالة التسجيل',
    statusValue: 'محفوظ',
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
    /** Shown when the project has more expenses than the list shows (EXPENSE_LIST_LIMIT). */
    olderHidden: (shown: number, total: number) => `يُعرض آخر ${shown} مصروفًا من ${total}. عرض الأقدم يأتي مع التصفية.`,
  },
} as const;

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
  unavailable: 'تعذّر حفظ المصروف الآن. تحقق من الاتصال ثم اضغط «حفظ المصروف» مرة أخرى: لن يُسجَّل مرتين.',
  no_project: 'لا يوجد مشروع بعد. أنشئ مشروعك أولًا.',
};

export type ExpenseFieldErrors = Partial<Record<ExpenseField, string>>;
