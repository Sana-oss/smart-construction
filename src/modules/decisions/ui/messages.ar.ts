import type { DecisionFailure } from '../application/comparison';
import type { ReviewStep } from '../domain/review';
import type { ComparisonErrorCode, MissingInput, Scenario } from '../domain/scenarios';

// Arabic text for the continue-or-pause comparison. Wording from the design: S18.1 «الاستمرار أو التوقف», S18.2
// «مراجعة السيناريو». Scenario 3 follows FR-DEC-01 («إكمال مرحلة ثم التوقف»), not the design's «تأجيل الأعمال التالية»
// (owner's decision of 19 Nov 2026). FR-DEC-05: the disclaimer is shown with every result.

export const decisionTextAr = {
  back: 'رجوع',
  lyd: 'د.ل',

  overview: {
    pageTitle: 'الاستمرار أو التوقف',
    title: 'الاستمرار أو التوقف',
    subtitle: 'مراجعة مالية تقديرية للمشروع',
    balance: 'الرصيد المتوقع بعد 30 يومًا',
    balanceUnknown: 'غير معروف',
    balanceUnknownNote: 'لم يُدخل «المتاح الآن» عند إنشاء المشروع، فلا يُحسب رصيد.',
    scenarios: 'السيناريوهات',
    scenario: {
      continue: 'الاستمرار حسب الخطة',
      pause: 'التوقف المؤقت الآن',
      finish_phase: (phase: string | null) => (phase ? `إكمال «${phase}» ثم التوقف` : 'إكمال مرحلة ثم التوقف'),
    },
    nowLater: (now: string, later: string) => `الآن ${now} د.ل · لاحقًا ${later} د.ل`,
    afterNow: (balance: string) => `الرصيد بعد 30 يومًا: ${balance} د.ل`,
    // Split around the amount, so the minus sign stays in place (<bdi dir="ltr">).
    shortfallBefore: (date: string) => `عجز من ${date}: ينزل الرصيد إلى`,
    total: 'التكلفة حتى الإكمال',
    missing: (items: string) => `ناقص: ${items}`,
    incomplete: 'ناقص',
    priceChange: (pct: string) => `تغير الأسعار المفترض لما يُشترى لاحقًا: ${pct}%`,
    noFigures: 'أدخل تكلفة الأعمال المتبقية لتظهر المقارنة.',
    priceWarnings: 'بيانات أسعار تحتاج مراجعة',
    stale: (material: string, unit: string, date: string) => `${material} (${unit}): آخر سعر بتاريخ ${date}، أقدم من 30 يومًا`,
    expired: (material: string, unit: string, date: string) => `${material} (${unit}): عرض منتهي منذ ${date}`,
    openPrices: 'فتح سجل الأسعار',
    // Design S18.1's context line, then the engineering note (master 3.7) and FR-DEC-05.
    disclaimer: 'الحساب تقديري ويعتمد على البيانات المدخلة، وليس قرارًا آليًا بالاستمرار أو سلامة التوقف.',
    engineer: 'سلامة التوقف وتسلسله والاستئناف يقررها مهندس مؤهل. هذه أداة مساعدة، وليست نصيحة مالية أو هندسية نهائية.',
    editFigures: 'إدخال تكاليف السيناريوهات',
    review: 'مراجعة السيناريو',
    saved: 'حُفظت الأرقام.',
    reviewSaved: 'حُفظت المراجعة.',
    chosen: (name: string) => `الطريقة المختارة في المراجعة: ${name}`,
  },

  missingInput: {
    remainingWorks: 'تكلفة الأعمال المتبقية',
    phase: 'المرحلة وتكلفة إكمالها',
    protection: 'الحماية',
    storage: 'التخزين',
    restart: 'إعادة التشغيل',
  } satisfies Record<MissingInput, string>,

  form: {
    pageTitle: 'تكاليف السيناريوهات',
    title: 'تكاليف السيناريوهات',
    subtitle: 'أرقامك أنت؛ ما تتركه فارغًا يظهر «ناقص»',
    remainingWorks: 'تكلفة الأعمال المتبقية حتى الإكمال · د.ل',
    remainingWorksHint: 'المواد والعمالة وغيرها لكل ما بقي من المشروع.',
    materialsOnHand: 'قيمة المواد الموجودة في الموقع · د.ل',
    materialsOnHandHint: 'مدفوعة من قبل، فتُخصم مرة واحدة.',
    phase: 'المرحلة التي تُكمل قبل التوقف',
    noPhase: 'لم تُحدَّد',
    phaseCost: 'تكلفة إكمال هذه المرحلة · د.ل',
    pauseGroup: 'تكاليف التوقف',
    protection: 'الحماية (تغطية الحديد، عزل الأسطح، التدعيم) · د.ل',
    storage: 'تخزين المواد وحراستها · د.ل',
    restart: 'إعادة تشغيل العمل · د.ل',
    pauseHint: 'مبالغ تقدّرها أنت أو مهندسك؛ لا يقترح النظام أرقامًا لها.',
    protectionFromPlan: (phase: string, amount: string) => `من خطة التوقف لمرحلة «${phase}»: ${amount} د.ل (مجموع تقديراتك للإجراءات). يمكنك تغييره.`,
    openPlan: 'فتح خطة التوقف',
    priceChangePct: 'تغير الأسعار لما يُشترى لاحقًا · %',
    priceChangeHint: 'مثل 10 لارتفاع 10% أو -5 لانخفاض 5%، أو 0 لثباتها. من -50 إلى 100. افتراضك أنت، لا توقع.',
    submit: 'حفظ الأرقام',
    submitting: 'جارٍ الحفظ…',
  },

  review: {
    pageTitle: 'مراجعة السيناريو',
    title: 'مراجعة السيناريو',
    subtitle: 'اعتماد خطة الأعمال والتمويل',
    note: 'ملاحظة المراجعة',
    stepsTitle: 'خطوات المراجعة',
    steps: {
      fundingConfirmed: 'تأكيد مصادر التمويل',
      contractsReviewed: 'مراجعة الالتزامات التعاقدية',
      siteAssessed: 'تقييم الأعمال بالموقع',
      planDecided: 'تحديد خطة التنفيذ أو التوقف',
    } satisfies Record<ReviewStep, string>,
    who: { owner: 'مالك المشروع', manager: 'مسؤول المشروع', engineer: 'المهندس المسؤول', joint: 'اعتماد مشترك' },
    ownerTicks: 'تعلّم أنت البنود بعد أن تتم في الواقع؛ النظام يسجّلها ولا يعتمدها.',
    choice: 'الطريقة المختارة',
    noChoice: 'لم تُحدَّد بعد',
    submit: 'حفظ المراجعة',
    submitting: 'جارٍ الحفظ…',
    backToComparison: 'العودة للمقارنة',
  },
} as const;

export const scenarioName = (s: Scenario, phase: string | null) =>
  s === 'finish_phase' ? decisionTextAr.overview.scenario.finish_phase(phase) : decisionTextAr.overview.scenario[s];

export const comparisonErrorsAr: Record<ComparisonErrorCode | 'too_long', string> = {
  required: 'هذا الحقل مطلوب.',
  invalid_number: 'اكتب رقمًا صحيحًا بثلاث خانات عشرية على الأكثر، مثل 200,000',
  must_be_positive: 'يجب أن يكون المبلغ أكبر من صفر.',
  too_large: 'الرقم كبير جدًا.',
  invalid_percent: 'اكتب نسبة مثل 10 أو -5 أو 12.5',
  percent_out_of_range: 'النسبة بين -50 و100.',
  unknown_choice: 'اختر من القائمة.',
  phase_more_than_remaining: 'تكلفة المرحلة لا تزيد على تكلفة الأعمال المتبقية كلها.',
  phase_cost_without_phase: 'اختر المرحلة أولًا، أو امسح تكلفتها.',
  too_long: 'النص طويل جدًا.',
};

export const decisionFailedAr: Record<DecisionFailure | 'no_project', string> = {
  not_allowed: 'لا تملك صلاحية تعديل هذا المشروع، أو انتهت الجلسة. سجّل الدخول من جديد.',
  rejected: 'تعذّر الحفظ. راجع الأرقام وحاول مرة أخرى.',
  unknown_reference: 'المرحلة المختارة لا تخص هذا المشروع.',
  unavailable: 'تعذّر الاتصال الآن. تحقق من الاتصال وحاول مرة أخرى.',
  no_project: 'لا يوجد مشروع بعد. أنشئ مشروعك أولًا.',
};
