'use server';

// Server Actions for one installment (FR-FIN-09): confirm the payment, release the retained part, undo either. In the app
// layer because the due state needs the phase (projects) and its photos (documents), and finance may import neither
// (rule R2). The project comes from the session, never from the form. A payment that is not due, or a release while a
// phase is not done, asks first and is allowed (decision D2); the confirmation is logged by the database (0032).

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { money, todayInTripoli } from '@/shared-kernel';
import {
  contractPath,
  getContractDetail,
  payPayment,
  paymentPath,
  releasePayment,
  settleErrorsAr,
  settleFailedAr,
  undoPaymentPaid,
  undoPaymentRelease,
  type PayFormState,
  type ReleaseFormState,
} from '@/modules/finance';
import { getMyProject } from '@/modules/projects';
import { dueByPayment } from '../../../due';

const text = (form: FormData, key: string) => String(form.get(key) ?? '');

export async function payAction(contractId: string, paymentId: string, _prev: PayFormState, form: FormData): Promise<PayFormState> {
  const values = { paidOn: text(form, 'paidOn'), expenseType: text(form, 'expenseType') };
  const project = await getMyProject();
  if (!project) return { formError: settleFailedAr.no_project, values };
  const detail = await getContractDetail(project.id, contractId);
  const payment = detail?.payments.find((p) => p.id === paymentId);
  if (!payment) return { formError: settleFailedAr.not_found, values };

  const due = (await dueByPayment(project, [payment]))[payment.id];
  const result = await payPayment({ projectId: project.id, paymentId, ...values, confirmed: form.get('confirmed') === 'yes' }, due, todayInTripoli());
  if (!result.ok) {
    if (result.kind === 'needs_confirm') return { needsConfirm: true, values };
    if (result.kind === 'invalid') {
      const fieldErrors: PayFormState['fieldErrors'] = {};
      for (const e of result.errors) if (e.field === 'paidOn' || e.field === 'expenseType') fieldErrors[e.field] ??= settleErrorsAr[e.code];
      return { fieldErrors, values };
    }
    return { formError: settleFailedAr[result.reason], values };
  }
  revalidatePath('/', 'layout');
  redirect(`${paymentPath(contractId, paymentId)}?done=${money(payment.amountLyd).eq(money(payment.retainedLyd)) ? 'paid-no-expense' : 'paid'}`);
}

export async function releaseAction(contractId: string, paymentId: string, _prev: ReleaseFormState, form: FormData): Promise<ReleaseFormState> {
  const values = { releasedOn: text(form, 'releasedOn'), expenseType: text(form, 'expenseType') };
  const project = await getMyProject();
  if (!project) return { formError: settleFailedAr.no_project, values };

  const result = await releasePayment(
    { projectId: project.id, paymentId, ...values, confirmed: form.get('confirmed') === 'yes' },
    { allPhasesDone: project.phases.every((p) => p.status === 'done') },
    todayInTripoli(),
  );
  if (!result.ok) {
    if (result.kind === 'needs_confirm') return { needsConfirm: true, values };
    if (result.kind === 'invalid') {
      const fieldErrors: ReleaseFormState['fieldErrors'] = {};
      for (const e of result.errors) if (e.field === 'releasedOn' || e.field === 'expenseType') fieldErrors[e.field] ??= settleErrorsAr[e.code];
      return { fieldErrors, values };
    }
    return { formError: settleFailedAr[result.reason], values };
  }
  revalidatePath('/', 'layout');
  redirect(`${paymentPath(contractId, paymentId)}?done=released`);
}

export async function undoPaymentAction(contractId: string, paymentId: string): Promise<void> {
  const project = await getMyProject();
  if (!project) redirect(contractPath(contractId));
  const result = await undoPaymentPaid({ projectId: project.id, paymentId });
  revalidatePath('/', 'layout');
  redirect(`${paymentPath(contractId, paymentId)}${result.ok ? '?done=undone-paid' : ''}`);
}

export async function undoReleaseAction(contractId: string, paymentId: string): Promise<void> {
  const project = await getMyProject();
  if (!project) redirect(contractPath(contractId));
  const result = await undoPaymentRelease({ projectId: project.id, paymentId });
  revalidatePath('/', 'layout');
  redirect(`${paymentPath(contractId, paymentId)}${result.ok ? '?done=undone-release' : ''}`);
}
