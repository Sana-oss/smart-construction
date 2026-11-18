import type { PhotoErrorCode } from '../domain/photo';
import type { PhotoFailure } from '../application/photos';
import type { DocumentErrorCode, DocumentKind, DocumentType } from '../domain/document';
import type { DocumentFailure } from '../application/documents';

// Arabic text for the site-photo screens. Wording from the design: S31.1 «صور الموقع», S31.2 «صورة وملاحظة».

const arPlural = new Intl.PluralRules('ar');

/** "6 صور", with Arabic number agreement. */
export function photosCountAr(n: number): string {
  switch (arPlural.select(n)) {
    case 'zero':
      return 'لا صور';
    case 'one':
      return 'صورة واحدة';
    case 'two':
      return 'صورتان';
    case 'few':
      return `${n} صور`;
    default:
      return `${n} صورة`;
  }
}

export const photosTextAr = {
  back: 'رجوع',
  gallery: {
    pageTitle: 'صور الموقع',
    title: 'صور الموقع',
    subtitle: 'سجل مرئي حسب المرحلة والتاريخ',
    noPhase: 'بلا مرحلة',
    groupMeta: (count: string, latest: string) => `${count} · آخرها ${latest}`,
    emptyTitle: 'لا توجد صور بعد',
    emptyBody: 'وثّق حالة الموقع بصورة وملاحظة، واربطها بمرحلتها.',
    add: 'إضافة صورة وملاحظة',
    open: 'فتح الصورة',
    noLink: 'تعذّر تحميل الصورة',
    delete: 'حذف',
    deleteConfirm: 'حذف هذه الصورة؟ لا يمكن التراجع.',
    photoAlt: (phase: string, date: string) => `صورة ${phase}، ${date}`,
  },
  form: {
    pageTitle: 'صورة وملاحظة',
    title: 'صورة وملاحظة',
    subtitle: 'توثيق حالة الموقع',
    photo: 'الصورة',
    pick: 'التقط صورة أو اختر من الهاتف',
    change: 'تغيير الصورة',
    phase: 'المرحلة',
    noPhase: 'غير مرتبطة بمرحلة',
    date: 'التاريخ',
    note: 'الملاحظة',
    notePlaceholder: 'مثلًا: تسليح السقف قبل مراجعة المهندس',
    sizes: (before: string, after: string) => `الحجم: ${before} ← ${after} بعد الضغط`,
    preparing: 'جارٍ تجهيز الصورة…',
    converting: 'جارٍ تحويل صورة الآيفون (HEIC)… قد يستغرق ذلك لحظات.',
    uploading: 'جارٍ رفع الصورة…',
    saving: 'جارٍ الحفظ…',
    save: 'حفظ الصورة والملاحظة',
    needPhoto: 'اختر صورة أولًا.',
    privacy: 'تُصغَّر الصورة في هاتفك قبل رفعها، ويُحذف منها موقعها الجغرافي وبيانات الكاميرا.',
  },
} as const;

export const photoErrorsAr: Record<PhotoErrorCode, string> = {
  invalid_id: 'اختر مرحلة من القائمة.',
  invalid_date: 'التاريخ غير صحيح.',
  date_in_future: 'تاريخ الصورة لا يكون بعد اليوم.',
  too_long: 'الملاحظة طويلة (500 حرف على الأكثر).',
  too_large: 'الصورة كبيرة جدًا (30 ميغابايت على الأكثر).',
  not_an_image: 'هذا الملف ليس صورة.',
};

/** Problems in the browser, before anything is sent. */
export const photoClientErrorsAr = {
  unreadable: 'تعذّرت قراءة الصورة. جرّب صورة أخرى، أو التقطها من جديد.',
  heicFailed: 'تعذّر تحويل صورة HEIC في هذا المتصفح. افتحها في هاتفك وأرسلها بصيغة JPEG، أو جرّب متصفحًا آخر.',
  uploadFailed: 'تعذّر رفع الصورة. تحقق من الاتصال وحاول مرة أخرى.',
};

export const photoFailedAr: Record<PhotoFailure, string> = {
  not_allowed: 'لا تملك صلاحية إضافة صور لهذا المشروع، أو انتهت الجلسة.',
  unknown_reference: 'هذه المرحلة ليست من مشروعك.',
  upload_missing: 'لم تصل الصورة كاملة. حاول مرة أخرى.',
  rejected: 'رُفضت الصورة. حاول مرة أخرى.',
  unavailable: 'تعذّر الحفظ. حاول مرة أخرى.',
};

// ---------------------------------------------------------------------------------------------------------------
// Documents. Wording from the design: S30.1 «وثائق المشروع», S30.2 «إضافة وثيقة», S10.4 «وثائق المرحلة».

export const documentKindAr: Record<DocumentKind, string> = {
  plan: 'مخطط',
  invoice: 'فاتورة',
  contract: 'عقد',
  warranty: 'ضمان',
  permit: 'تصريح',
  structural_assessment: 'تقييم إنشائي',
  other: 'أخرى',
};

export const documentTypeAr: Record<DocumentType, string> = {
  'application/pdf': 'PDF',
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
};

/** "3 ملفات", with Arabic number agreement. */
export function filesCountAr(n: number): string {
  switch (arPlural.select(n)) {
    case 'zero':
      return 'لا ملفات';
    case 'one':
      return 'ملف واحد';
    case 'two':
      return 'ملفان';
    case 'few':
      return `${n} ملفات`;
    default:
      return `${n} ملفًا`;
  }
}

export const documentsTextAr = {
  back: 'رجوع',
  list: {
    pageTitle: 'وثائق المشروع',
    title: 'وثائق المشروع',
    subtitle: 'نسخ معتمدة ومرفقات التنفيذ',
    phaseTitle: 'وثائق المرحلة',
    phaseSubtitle: (phase: string, count: string) => `${phase} · ${count}`,
    allDocuments: 'كل وثائق المشروع',
    version: (v: string) => `الإصدار ${v}`,
    open: 'عرض',
    openLabel: (title: string) => `عرض: ${title}`,
    noLink: 'غير متاح',
    delete: 'حذف',
    deleteLabel: (title: string) => `حذف: ${title}`,
    deleteConfirm: (title: string) => `حذف الوثيقة «${title}»؟ لا يمكن التراجع.`,
    photosRow: 'صور الموقع',
    photosNote: 'سجل الصور حسب المرحلة',
    emptyTitle: 'لا توجد وثائق بعد',
    emptyBody: 'احفظ المخططات والعقود والفواتير والتصاريح في مكان واحد. رفع الوثائق ليس شرطًا لاستخدام النظام.',
    add: 'إضافة وثيقة',
  },
  form: {
    pageTitle: 'إضافة وثيقة',
    title: 'إضافة وثيقة',
    subtitle: 'احفظ النسخة ومصدرها في المشروع',
    name: 'اسم الوثيقة',
    namePlaceholder: 'مثلًا: مخطط السقف المعتمد',
    kind: 'نوع الوثيقة',
    kindPlaceholder: 'اختر نوع الوثيقة',
    phase: 'المرحلة المرتبطة',
    noPhase: 'المشروع كله',
    version: 'رقم الإصدار',
    versionPlaceholder: 'مثلًا: 03',
    file: 'الملف',
    pick: 'اختر ملف PDF أو صورة',
    change: 'تغيير الملف',
    fileHelper: 'PDF أو JPEG أو PNG حتى 10 ميغابايت. صور الآيفون (HEIC) تُحوَّل إلى JPEG.',
    converting: 'جارٍ تحويل الصورة…',
    uploading: 'جارٍ رفع الملف…',
    saving: 'جارٍ الحفظ…',
    save: 'حفظ الوثيقة',
    needFile: 'اختر ملفًا أولًا.',
  },
} as const;

export const documentErrorsAr: Record<DocumentErrorCode, string> = {
  required: 'هذا الحقل مطلوب.',
  too_short: 'النص قصير جدًا.',
  too_long: 'النص طويل جدًا.',
  unknown_choice: 'اختر من القائمة.',
  invalid_id: 'اختر مرحلة من القائمة.',
  wrong_type: 'نوع الملف غير مقبول. اختر PDF أو صورة.',
  too_large: 'الملف كبير جدًا (10 ميغابايت على الأكثر).',
};

export const documentFailedAr: Record<DocumentFailure, string> = {
  not_allowed: 'لا تملك صلاحية إضافة وثائق لهذا المشروع، أو انتهت الجلسة.',
  unknown_reference: 'هذه المرحلة ليست من مشروعك.',
  upload_missing: 'لم يصل الملف كاملًا. حاول مرة أخرى.',
  rejected: 'رُفض الملف. تأكد أنه PDF أو صورة لا تتجاوز 10 ميغابايت.',
  unavailable: 'تعذّر الحفظ. حاول مرة أخرى.',
};
