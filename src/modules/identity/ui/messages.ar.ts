import type { AuthFailure } from '../application/auth-gateway';
import type { CredentialsErrorCode } from '../domain/credentials';
import { OTP_LENGTH } from '../domain/otp';
import { PASSWORD_MIN_LENGTH } from '../domain/credentials';
import { PASSPORT_MAX_LENGTH, PASSPORT_MIN_LENGTH } from '../domain/identity-document';

// User-facing Arabic messages for the identity module (UI rule: strings live in message files).
// The domain and use cases return codes only; this file is the single place that turns them into text.

export const fieldMessagesAr: Record<CredentialsErrorCode, string> = {
  phone_required: 'أدخل رقم الهاتف.',
  phone_invalid: 'رقم الهاتف غير صحيح. اكتبه هكذا: 0912345678',
  password_required: 'أدخل كلمة المرور.',
  password_too_short: `كلمة المرور قصيرة. استخدم ${PASSWORD_MIN_LENGTH} أحرف على الأقل.`,
  password_too_long: 'كلمة المرور طويلة جدًا.',
  full_name_too_long: 'الاسم طويل جدًا.',
  otp_required: 'أدخل رمز التحقق الذي وصلك برسالة.',
  otp_invalid: `رمز التحقق ${OTP_LENGTH} أرقام.`,
  nationality_required: 'اختر الجنسية: ليبي أو غير ليبي.',
  national_id_required: 'أدخل الرقم الوطني.',
  national_id_invalid: 'الرقم الوطني غير صحيح. يتكون من 12 رقمًا ويبدأ بـ1 أو 2.',
  passport_required: 'أدخل رقم جواز السفر.',
  passport_invalid: `رقم جواز السفر غير صحيح. استخدم من ${PASSPORT_MIN_LENGTH} إلى ${PASSPORT_MAX_LENGTH} حرفًا لاتينيًا أو رقمًا.`,
};

export const failureMessagesAr: Record<AuthFailure, string> = {
  phone_taken: 'هذا الرقم مسجّل من قبل. سجّل الدخول بدلًا من ذلك.',
  invalid_credentials: 'رقم الهاتف أو كلمة المرور غير صحيحة.',
  phone_not_confirmed: 'لم يُؤكَّد رقم الهاتف بعد. أدخل رمز التحقق الذي وصلك.',
  otp_rejected: 'رمز التحقق غير صحيح أو انتهت صلاحيته.',
  rate_limited: 'محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.',
  phone_auth_disabled: 'التسجيل برقم الهاتف غير مفعّل حاليًا.',
  sms_failed: 'تعذّر إرسال رسالة التحقق. حاول مرة أخرى بعد قليل.',
  weak_password: 'كلمة المرور ضعيفة. اختر كلمة أطول أو أصعب تخمينًا.',
  // Deliberately does not say WHICH number is taken, so the form cannot be used to check whether
  // someone's national number is registered.
  identity_document_rejected: 'تعذّر إنشاء الحساب. إن كان رقمك الوطني أو جوازك مسجّلًا من قبل، فسجّل الدخول بحسابك.',
  auth_unavailable: 'حدث خطأ غير متوقع. حاول مرة أخرى.',
};

// Brand block shared by the auth screens (design .auth-brand).
export const brandTextAr = {
  name: 'ركيزة',
  tagline: 'كل خطوة تبني مشروعك',
  logoAlt: 'شعار ركيزة',
} as const;

// Welcome screen for visitors. Design: v2 screen S01.1 (replaces Design/Screens/screen (1).png).
export const welcomeTextAr = {
  pageTitle: 'منصة ركيزة',
  heading: 'منصة ركيزة',
  intro: 'رفيقك من أول مخطط إلى التسليم',
  info: 'تابع مشروعك ومراحله ومصروفاته في مكان واحد.',
  signIn: 'تسجيل الدخول',
  createAccount: 'إنشاء حساب جديد',
} as const;

// Screen text for the sign-in page. Design: v2 screen S01.2 (https://rakeeza-ux-review-v2.vercel.app/#S01.2).
export const signInTextAr = {
  pageTitle: 'تسجيل الدخول',
  heading: 'مرحبًا بعودتك',
  intro: 'سجّل دخولك لمتابعة مشروعك',
  requiredHint: 'الحقول المميزة بـ * مطلوبة.',
  phoneLabel: 'رقم الهاتف',
  phonePlaceholder: '+218 91 000 0000',
  passwordLabel: 'كلمة المرور',
  submit: 'تسجيل الدخول',
  submitting: 'جارٍ تسجيل الدخول…',
  createAccount: 'إنشاء حساب جديد',
} as const;

// Session text (home page until the dashboard is built).
export const sessionTextAr = {
  signedInAs: 'أنت مسجّل الدخول.',
  signOut: 'تسجيل الخروج',
  signingOut: 'جارٍ تسجيل الخروج…',
  signIn: 'تسجيل الدخول',
  signedOut: 'لم تسجّل الدخول بعد.',
} as const;
