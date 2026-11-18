import type { PhotoErrorCode } from '../domain/photo';
import type { PhotoFailure } from '../application/photos';

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
