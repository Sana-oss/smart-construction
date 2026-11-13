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
  nextStepSoon: 'تسجيل المصروفات هو الميزة التالية في التطبيق.',
  // FR-PRJ-02. Warning text; to be reviewed by the project's engineer (engineering content).
  addFloorWarning:
    'مشروع إضافة طابق: قبل بدء العمل يجب أن يقيّم مهندس إنشائي قدرة المبنى الحالي على تحمّل الطابق الجديد. النظام ينبّه ولا يعتمد السلامة.',
} as const;
