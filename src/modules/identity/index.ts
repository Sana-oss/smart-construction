// Public API of the identity module. Other code imports ONLY from "@/modules/identity".
// Owns tables: profiles, project_members, shared_reports (architecture §4.3).

// Domain (pure, safe anywhere, including Client Components for instant form feedback)
export { normalizeLibyanMobile, LIBYAN_MOBILE_PREFIXES } from './domain/phone';
export {
  validateSignUp,
  validateSignIn,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  type FieldError,
  type CredentialsField,
} from './domain/credentials';
export { OTP_LENGTH } from './domain/otp';
export {
  validateIdentityDocument,
  normalizeNationalId,
  normalizePassportNumber,
  PASSPORT_MIN_LENGTH,
  PASSPORT_MAX_LENGTH,
  type Nationality,
  type IdentityDocument,
} from './domain/identity-document';

// Messages (Arabic) for forms and screens
export { fieldMessagesAr, failureMessagesAr, signInTextAr, welcomeTextAr, sessionTextAr } from './ui/messages.ar';

// UI components and session lookup for pages
export { SignInForm } from './ui/SignInForm';
export { WelcomeScreen } from './ui/WelcomeScreen';
export { SignOutButton } from './ui/SignOutButton';
export { getSignedInUserId } from './ui/session';

// Server Actions for the auth pages (FR-ID-01). Use with React's useActionState.
export { signUpAction, signInAction, verifyPhoneAction, signOutAction, type AuthFormState } from './ui/actions';
export { HOME_PATH, SIGN_IN_PATH, SIGN_UP_PATH, AFTER_SIGN_UP_PATH } from './ui/routes';
