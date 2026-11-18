// Arabic text for the project summary (first slice of the dashboard, FR-DSH-01; decision 12 of 14 Nov 2026).

export const summaryTextAr = {
  pageTitle: 'لوحة المشروع',
  heading: 'لوحة المشروع',
  projectName: 'اسم المشروع',
  area: (m2: string) => `${m2} م²`,
  currentPhase: 'المرحلة الحالية',
  phaseOf: (pos: number, total: number) => `${pos} من ${total}`,
  noCurrentPhase: 'لم تُحدَّد',
  totalBudget: 'الميزانية الإجمالية',
  spent: 'المصروف',
  spentNote: 'شاملًا المصروف قبل استخدام التطبيق',
  remaining: 'المتبقي',
  contingency: (pct: string) => `بند الطوارئ (${pct}%)`,
  overBudget: 'المصروف تجاوز الميزانية الإجمالية.',
  available: (date: string) => `المتاح حتى ${date}`,
  lyd: 'د.ل',
  nextStep: 'الخطوة التالية: سجّل أول مصروف',
  // Wording from the design: S13.3 (empty expenses) and the S07.1 action button.
  nextStepBody: 'سجّل الإنفاق لتتابع تكلفة المشروع وتقارنها بالميزانية.',
  addExpense: 'إضافة مصروف سريع',
  // S07.1 «المصروفات» row: opens the expenses list (S13.1).
  viewExpenses: 'عرض المصروفات',
  // S07.1 «مراحل المشروع» row: opens the phases screen (S09.1).
  viewPhases: 'مراحل المشروع',
  // FR-PRJ-02. Warning text; to be reviewed by the project's engineer (engineering content).
  addFloorWarning:
    'مشروع إضافة طابق: قبل بدء أعمال الطابق الجديد يجب أن يقيّم مهندس إنشائي قدرة المبنى الحالي على تحمّله. هذا تنبيه لا يمنعك من استخدام التطبيق، والنظام لا يعتمد السلامة.',
} as const;
