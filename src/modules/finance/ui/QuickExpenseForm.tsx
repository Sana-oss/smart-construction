'use client';

// Quick expense (FR-FIN-02, UC-07). Design: S14.1 «مصروف سريع» and S14.2 «تم حفظ المصروف».
// Six fields, as in the design: name, amount, type, phase, supplier or beneficiary, date. The owner types
// three (name, amount, type); the phase starts on the current phase, the date on today, the supplier is optional.
// The saved screen's main button opens the expenses list (S13.1), as in the design.
// Optional receipt photo (UC-07; not in the design's S14.1, change register 18 Nov): after the six fields, so the
// three required answers stay first. It is compressed in the browser, uploaded with a one-time token
// (prepareReceiptUploadAction), and checked by the server with the expense; with no photo, nothing changes.
// The form posts to createExpenseAction (a Server Action); all rules are checked again on the server.

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { checkPickedImage, formatAmount } from '@/shared-kernel';
import { compressImage } from '@/platform/images/compress-image';
import { createBrowserSupabase } from '@/platform/supabase/browser';
import { PROJECT_FILES_BUCKET } from '@/platform/supabase/storage';
import type { SavedExpense } from '../application/create-expense';
import { EXPENSE_TYPES, validateNewExpense, type ExpenseField } from '../domain/expense';
import { createExpenseAction, prepareReceiptUploadAction, type ExpenseFormState } from './actions';
import { BackIcon } from './icons';
import { expenseTextAr as t, expenseTypeAr } from './messages.ar';
import { EXPENSES_PATH } from './routes';
import styles from './expense.module.css';

export interface ExpensePhaseOption {
  id: string;
  name: string;
  /** True for the phase the project is in now: the form starts on it. */
  current: boolean;
}

interface Props {
  phases: ExpensePhaseOption[];
  /** Today's date in Libya, "YYYY-MM-DD", from the server. */
  today: string;
  /** Where the back button goes. */
  homeHref: string;
}

const initialState: ExpenseFormState = {};
const FORM_ID = 'quick-expense-form';

/** "2026-11-09" -> "9 نوفمبر 2026". Noon UTC keeps the day the same in every time zone. */
const dateAr = (iso: string) =>
  new Intl.DateTimeFormat('ar-LY', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Tripoli' }).format(
    new Date(`${iso}T12:00:00Z`),
  );

/**
 * One "round" = one expense. Pressing «إضافة مصروف آخر» starts a new round: React builds a fresh form (the
 * `key` changes), with an empty state and a NEW client_op_id.
 */
export function QuickExpenseForm(props: Props) {
  const [round, setRound] = useState(0);
  return <ExpenseRound key={round} {...props} onAnother={() => setRound((r) => r + 1)} />;
}

function ExpenseRound({ phases, today, homeHref, onAnother }: Props & { onAnother: () => void }) {
  const [state, formAction, pending] = useActionState(createExpenseAction, initialState);

  // client_op_id: made ONCE per expense, in the browser. Every retry of this form (double tap, weak connection)
  // sends the same id, so the server stores the expense once (NFR-REL-01). Made after the page loads, because
  // the server's HTML and the browser's must be identical on first render.
  const [clientOpId, setClientOpId] = useState('');
  useEffect(() => {
    setClientOpId(crypto.randomUUID());
  }, []);

  // Receipt photo (optional): compressed when picked, uploaded only when the expense is sent.
  const [receipt, setReceipt] = useState<{ blob: Blob; url: string } | null>(null);
  const [receiptStep, setReceiptStep] = useState<'idle' | 'preparing' | 'converting' | 'uploading'>('idle');
  const [receiptError, setReceiptError] = useState<string | null>(null);
  useEffect(() => () => void (receipt && URL.revokeObjectURL(receipt.url)), [receipt]);

  async function pickReceipt(file: File | undefined) {
    setReceiptError(null);
    if (!file) return;
    const problem = checkPickedImage(file);
    if (problem) {
      setReceiptError(problem === 'too_large' ? t.form.receiptTooLarge : t.form.receiptNotImage);
      return;
    }
    setReceiptStep('preparing');
    const result = await compressImage(file, () => setReceiptStep('converting'));
    setReceiptStep('idle');
    if (!result.ok) {
      setReceiptError(result.reason === 'heicFailed' ? t.form.receiptHeicFailed : t.form.receiptUnreadable);
      return;
    }
    setReceipt({ blob: result.photo.blob, url: URL.createObjectURL(result.photo.blob) });
  }

  /**
   * With a receipt: check the expense in the browser first (nothing is uploaded for a form the server will refuse),
   * then upload the photo and send its path with the expense. Without one: exactly as before.
   */
  async function send(form: FormData) {
    setReceiptError(null);
    const read = (k: string) => String(form.get(k) ?? '');
    const checked = validateNewExpense(
      {
        title: read('title'),
        amount: read('amount'),
        expenseType: read('expenseType'),
        phaseId: read('phaseId'),
        payee: read('payee'),
        paidOn: read('paidOn'),
        clientOpId: read('clientOpId'),
      },
      today,
    );
    if (receipt && checked.ok) {
      setReceiptStep('uploading');
      const ticket = await prepareReceiptUploadAction();
      if (!ticket.ok) {
        setReceiptStep('idle');
        setReceiptError(ticket.message);
        return;
      }
      const upload = await createBrowserSupabase()
        .storage.from(PROJECT_FILES_BUCKET)
        .uploadToSignedUrl(ticket.path, ticket.token, receipt.blob, { contentType: 'image/jpeg' });
      setReceiptStep('idle');
      if (upload.error) {
        setReceiptError(t.form.receiptUploadFailed);
        return;
      }
      form.set('receiptPath', ticket.path);
    }
    formAction(form);
  }
  const busy = pending || receiptStep !== 'idle';

  if (state.saved) return <Saved expense={state.saved} phases={phases} onAnother={onAnother} />;

  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};
  const invalid = (name: ExpenseField) => ({
    'aria-invalid': errors[name] ? (true as const) : undefined,
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
  });
  const errorOf = (name: ExpenseField) =>
    errors[name] && (
      <p id={`${name}-error`} className={styles.fieldError}>
        {errors[name]}
      </p>
    );
  const star = <span aria-hidden="true">*</span>;

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link href={homeHref} className={styles.iconButton} aria-label={t.back}>
          <BackIcon />
        </Link>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{t.form.title}</h1>
          <p className={styles.subtitle}>{t.form.subtitle}</p>
        </div>
      </header>

      <div className={styles.scroll}>
        {/* key: after a refused submission React resets the form, and a <select> does not take its new default value
            (the type went back to «اختر نوع المصروف»). Rebuilding the form with the values sent back keeps every field. */}
        <form id={FORM_ID} action={send} noValidate key={JSON.stringify(state.values ?? {})}>
          {state.formError && (
            <p role="alert" className={styles.errorSummary}>
              {state.formError}
            </p>
          )}
          <p className={styles.hint}>{t.requiredHint}</p>
          <input type="hidden" name="clientOpId" value={clientOpId} />

          <div className={styles.field}>
            <label htmlFor="title" className={styles.label}>
              {t.form.name} {star}
            </label>
            <input
              id="title"
              name="title"
              type="text"
              autoComplete="off"
              required
              className={styles.input}
              defaultValue={values.title ?? ''}
              {...invalid('title')}
            />
            {errorOf('title')}
          </div>

          <div className={styles.field}>
            <label htmlFor="amount" className={styles.label}>
              {t.form.amount} {star}
            </label>
            <input
              id="amount"
              name="amount"
              type="text"
              inputMode="decimal"
              dir="ltr"
              autoComplete="off"
              required
              className={styles.input}
              defaultValue={values.amount ?? ''}
              {...invalid('amount')}
            />
            {errorOf('amount')}
          </div>

          <div className={styles.field}>
            <label htmlFor="expenseType" className={styles.label}>
              {t.form.type} {star}
            </label>
            <select
              id="expenseType"
              name="expenseType"
              required
              className={styles.input}
              defaultValue={values.expenseType ?? ''}
              {...invalid('expenseType')}
            >
              <option value="" disabled>
                {t.form.typePlaceholder}
              </option>
              {EXPENSE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {expenseTypeAr[type]}
                </option>
              ))}
            </select>
            {errorOf('expenseType')}
          </div>

          <div className={styles.field}>
            <label htmlFor="phaseId" className={styles.label}>
              {t.form.phase}
            </label>
            <select
              id="phaseId"
              name="phaseId"
              className={styles.input}
              defaultValue={values.phaseId ?? phases.find((p) => p.current)?.id ?? ''}
              {...invalid('phaseId')}
            >
              <option value="">{t.form.noPhase}</option>
              {phases.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {errorOf('phaseId')}
          </div>

          <div className={styles.field}>
            <label htmlFor="payee" className={styles.label}>
              {t.form.payee}
            </label>
            <input
              id="payee"
              name="payee"
              type="text"
              autoComplete="off"
              className={styles.input}
              defaultValue={values.payee ?? ''}
              {...invalid('payee')}
            />
            {errorOf('payee')}
          </div>

          <div className={styles.field}>
            <label htmlFor="paidOn" className={styles.label}>
              {t.form.date}
            </label>
            <input
              id="paidOn"
              name="paidOn"
              type="date"
              max={today}
              className={styles.input}
              defaultValue={values.paidOn ?? today}
              {...invalid('paidOn')}
            />
            {errorOf('paidOn')}
          </div>

          <div className={styles.field}>
            <span className={styles.label} id="receipt-label">
              {t.form.receipt} <small className={styles.optional}>({t.form.receiptOptional})</small>
            </span>
            {receipt && <img src={receipt.url} alt="" className={styles.receiptPreview} />}
            <label className={receipt ? `${styles.picker} ${styles.pickerCompact}` : styles.picker}>
              <input
                type="file"
                accept="image/*,.heic,.heif"
                className={styles.visuallyHidden}
                aria-labelledby="receipt-label"
                aria-invalid={receiptError ? true : undefined}
                aria-describedby={receiptError ? 'receipt-error' : undefined}
                disabled={busy}
                onChange={(e) => void pickReceipt(e.target.files?.[0])}
              />
              {receipt ? t.form.receiptChange : t.form.receiptPick}
            </label>
            {receipt && (
              <button type="button" className={styles.linkButton} onClick={() => setReceipt(null)} disabled={busy}>
                {t.form.receiptRemove}
              </button>
            )}
            {receiptStep !== 'idle' && (
              <p role="status" className={styles.hint}>
                {receiptStep === 'converting'
                  ? t.form.receiptConverting
                  : receiptStep === 'uploading'
                    ? t.form.receiptUploading
                    : t.form.receiptPreparing}
              </p>
            )}
            {receiptError && (
              <p id="receipt-error" role="alert" className={styles.fieldError}>
                {receiptError}
              </p>
            )}
          </div>
        </form>
      </div>

      {/* The button sits at the bottom of the screen (thumb reach); `form` links it to the form above.
          Disabled until the client_op_id exists, so an expense is never sent without it. */}
      <div className={styles.actions}>
        <button type="submit" form={FORM_ID} className={styles.primary} disabled={busy || clientOpId === ''}>
          {busy ? t.form.submitting : t.form.submit}
        </button>
      </div>
    </main>
  );
}

function Saved({
  expense,
  phases,
  onAnother,
}: {
  expense: SavedExpense & { duplicate: boolean };
  phases: ExpensePhaseOption[];
  onAnother: () => void;
}) {
  const phaseName = phases.find((p) => p.id === expense.phaseId)?.name;
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{t.saved.title}</h1>
        </div>
      </header>

      <div className={styles.scroll}>
        {expense.duplicate && (
          <p role="status" className={styles.info}>
            {t.saved.duplicate}
          </p>
        )}

        <div className={styles.summaryCard} role="status">
          <small>{expense.title}</small>
          <strong>
            {/* <bdi dir="ltr"> keeps the digits in the right order inside Arabic text. */}
            <bdi dir="ltr">{formatAmount(expense.amountLyd)}</bdi> {t.lyd}
          </strong>
          <p>{[expenseTypeAr[expense.expenseType], phaseName].filter(Boolean).join(' · ')}</p>
        </div>

        <div className={styles.list}>
          <div className={styles.listRow}>
            <span className={styles.rowText}>
              <strong>{t.saved.payee}</strong>
              <small>{expense.payee ?? t.saved.noPayee}</small>
            </span>
            <span className={styles.rowValue}>{dateAr(expense.paidOn)}</span>
          </div>
          <div className={styles.listRow}>
            <span className={styles.rowText}>
              <strong>{t.saved.status}</strong>
              <small>{t.saved.statusNote}</small>
            </span>
            <span className={styles.rowValue}>{t.saved.statusValue}</span>
          </div>
          <div className={styles.listRow}>
            <span className={styles.rowText}>
              <strong>{t.saved.receipt}</strong>
            </span>
            <span className={styles.rowValue}>{expense.hasReceipt ? t.saved.receiptAttached : t.saved.receiptNone}</span>
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <Link href={EXPENSES_PATH} className={styles.primary}>
          {t.saved.toList}
        </Link>
        <button type="button" className={styles.secondary} onClick={onAnother}>
          {t.saved.another}
        </button>
      </div>
    </main>
  );
}
