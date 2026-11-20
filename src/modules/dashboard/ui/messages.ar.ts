// Arabic text for the project dashboard (FR-DSH-01, FR-DSH-02; design S07.1 «لوحة المشروع»).

export const summaryTextAr = {
  pageTitle: 'لوحة المشروع',
  heading: 'لوحة المشروع',
  subtitle: (project: string, firstName: string | null) => (firstName ? `${project} · مرحبًا ${firstName}` : project),
  lyd: 'د.ل',

  // Summary card (S07.1). The percentage is the domain's overallProgress (decision of 19 Nov 2026).
  progress: 'التقدم العام',
  noProgress: '—',
  currentPhase: (name: string) => `المرحلة الحالية: ${name}`,
  noCurrentPhase: 'لا مرحلة قيد التنفيذ الآن',

  // «الخطوة التالية» row (FR-DSH-02; order approved 19 Nov 2026).
  nextStep: 'الخطوة التالية',
  next: {
    first_expense: { note: 'سجّل أول مصروف', action: 'إضافة' },
    daily_expense: { note: 'سجّل مصروفات اليوم', action: 'إضافة' },
    late_phase: { note: (phase: string) => `راجع تأخر مرحلة «${phase}»`, action: 'مراجعة' },
    overdue_task: { note: (task: string) => `أنجز المهمة: ${task}`, action: 'فتح' },
    set_dates: { note: (phase: string) => `حدّد تواريخ مرحلة «${phase}»`, action: 'تحديد' },
  },

  // Rows (S07.1)
  expenses: 'المصروفات',
  expensesNote: (budget: string) => `من ميزانية ${budget} د.ل`,
  budget: 'المتبقي من الميزانية',
  budgetNote: (contingency: string, pct: string) => `بند الطوارئ ${contingency} د.ل (${pct}%)`,
  availableNote: (amount: string, date: string) => `المتاح حتى ${date}: ${amount} د.ل`,
  phases: 'مراحل المشروع',
  phasesNote: 'متابعة التنفيذ والفحص',
  phaseOf: (pos: number, total: number) => `${pos} من ${total}`,
  materials: 'المواد والكميات',
  materialsNote: 'مراجعة المطلوب والمتبقي',
  materialsOver: (n: number) => (n === 1 ? 'بند واحد فوق الكمية المسموحة' : `${n} بنود فوق الكمية المسموحة`),
  items: (n: number) => (n === 1 ? 'بند واحد' : n === 2 ? 'بندان' : `${n} بنود`),
  more: 'المزيد',
  moreNote: 'الوثائق والصور والحساب',
  open: 'فتح',

  overBudget: 'المصروف تجاوز الميزانية الإجمالية.',
  addExpense: 'إضافة مصروف سريع',
  // FR-PRJ-02. Warning text; to be reviewed by the project's engineer (engineering content).
  addFloorWarning:
    'مشروع إضافة طابق: قبل بدء أعمال الطابق الجديد يجب أن يقيّم مهندس إنشائي قدرة المبنى الحالي على تحمّله. هذا تنبيه لا يمنعك من استخدام التطبيق، والنظام لا يعتمد السلامة.',
} as const;
