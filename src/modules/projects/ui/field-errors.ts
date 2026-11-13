import type { SetupError } from '../domain/project-setup';
import { setupErrorsAr, type SetupFieldErrors } from './messages.ar';

/** Domain errors -> one Arabic message per field (the first error of each field). */
export function toFieldErrors(errors: SetupError[]): SetupFieldErrors {
  const out: SetupFieldErrors = {};
  for (const e of errors) out[e.field] ??= setupErrorsAr[e.code];
  return out;
}
