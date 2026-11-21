'use server';

// Server Actions for the payment schedule and for deleting (FR-FIN-08, FR-FIN-09). Run on the server as the signed-in
// user, under RLS. The project comes from the session, never from the form; the use cases check every value; the
// database audits every change (0031). Saving a contract is in src/app/contracts/actions.ts: it checks the contract copy.

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getMyProject } from '@/modules/projects';
import { createServerSupabase } from '@/platform/supabase/server';
import { addPayment, removeContract, removePayment, updatePayment } from '../application/contracts';
import type { PaymentField } from '../domain/contracts';
import { supabaseContractStore } from '../infra/supabase-contract-store';
import { contractErrorsAr, contractFailedAr, contractsTextAr, expenseErrorsAr } from './messages.ar';
import { CONTRACTS_PATH, contractPath } from './routes';

const FIELDS = ['title', 'amount', 'phaseId', 'retained'] as const;

export interface PaymentFormState {
  fieldErrors?: Partial<Record<PaymentField, string>>;
  formError?: string;
  values?: Partial<Record<(typeof FIELDS)[number], string>>;
}

/** Bound to one contract: add an installment to its schedule. */
export async function addPaymentAction(contractId: string, _prev: PaymentFormState, form: FormData): Promise<PaymentFormState> {
  const values = Object.fromEntries(FIELDS.map((k) => [k, String(form.get(k) ?? '')])) as Record<(typeof FIELDS)[number], string>;
  const project = await getMyProject();
  if (!project) return { formError: contractFailedAr.no_project, values };
  // The phase must be one of this project's (the database checks again, 0031).
  if (values.phaseId && !project.phases.some((p) => p.id === values.phaseId.trim().toLowerCase())) {
    return { fieldErrors: { phaseId: expenseErrorsAr.unknown_choice }, values };
  }
  const result = await addPayment(supabaseContractStore(await createServerSupabase()), { ...values, projectId: project.id, contractId });
  if (!result.ok) {
    if (result.kind === 'failed') return { formError: contractFailedAr[result.reason], values };
    const fieldErrors: PaymentFormState['fieldErrors'] = {};
    for (const e of result.errors) fieldErrors[e.field] ??= contractErrorsAr[e.code];
    return { fieldErrors, values };
  }
  revalidatePath('/', 'layout');
  redirect(`${contractPath(contractId)}?done=payment-added`);
}

/** Bound to one installment: edit it while it is unpaid (3.16 deepening). A paid one is refused: undo the payment first. */
export async function updatePaymentAction(contractId: string, paymentId: string, _prev: PaymentFormState, form: FormData): Promise<PaymentFormState> {
  const values = Object.fromEntries(FIELDS.map((k) => [k, String(form.get(k) ?? '')])) as Record<(typeof FIELDS)[number], string>;
  const project = await getMyProject();
  if (!project) return { formError: contractFailedAr.no_project, values };
  if (values.phaseId && !project.phases.some((p) => p.id === values.phaseId.trim().toLowerCase())) {
    return { fieldErrors: { phaseId: expenseErrorsAr.unknown_choice }, values };
  }
  const result = await updatePayment(supabaseContractStore(await createServerSupabase()), { ...values, projectId: project.id, id: paymentId });
  if (!result.ok) {
    if (result.kind === 'paid') return { formError: contractsTextAr.editPaymentForm.paid, values };
    if (result.kind === 'failed') return { formError: contractFailedAr[result.reason], values };
    const fieldErrors: PaymentFormState['fieldErrors'] = {};
    for (const e of result.errors) fieldErrors[e.field] ??= contractErrorsAr[e.code];
    return { fieldErrors, values };
  }
  revalidatePath('/', 'layout');
  redirect(`${contractPath(contractId)}?done=payment-updated`);
}

export async function deletePaymentAction(contractId: string, paymentId: string): Promise<void> {
  const project = await getMyProject();
  if (!project) redirect(CONTRACTS_PATH);
  const result = await removePayment(supabaseContractStore(await createServerSupabase()), { projectId: project.id, id: paymentId });
  revalidatePath('/', 'layout');
  redirect(result.ok ? `${contractPath(contractId)}?done=payment-deleted` : contractPath(contractId));
}

export async function deleteContractAction(contractId: string): Promise<void> {
  const project = await getMyProject();
  if (!project) redirect(CONTRACTS_PATH);
  const result = await removeContract(supabaseContractStore(await createServerSupabase()), { projectId: project.id, id: contractId });
  revalidatePath('/', 'layout');
  redirect(result.ok ? `${CONTRACTS_PATH}?done=deleted` : CONTRACTS_PATH);
}
