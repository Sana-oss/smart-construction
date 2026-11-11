import type { AuthFailure } from '../application/auth-gateway';
import type { CredentialsErrorCode } from '../domain/credentials';
import { OTP_LENGTH } from '../domain/otp';
import { PASSWORD_MIN_LENGTH } from '../domain/credentials';

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
  auth_unavailable: 'حدث خطأ غير متوقع. حاول مرة أخرى.',
};
