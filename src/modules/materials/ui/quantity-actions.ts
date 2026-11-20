'use server';

// Server Actions for the quantity table (FR-MAT-01). Run on the server as the signed-in user, under RLS. The project
// comes from the session, never from the form; the use cases check every value; the database audits changes (0024).
// Recording a purchase is the app's action (src/app/materials/items/[id]/purchase/actions.ts): it also needs finance.

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getMyProject } from '@/modules/projects';
import { createServerSupabase } from '@/platform/supabase/server';
import { addItem, deleteItem } from '../application/quantities';
import type { ItemField } from '../domain/quantities';
import { supabaseQuantityStore } from '../infra/supabase-quantity-store';
import { qtyErrorsAr, qtyFailedAr } from './messages.ar';
import { itemPath, MATERIALS_PATH } from './routes';

const FIELDS = ['material', 'unit', 'plannedQty', 'wastePct', 'phaseId', 'source', 'verifiedBy'] as const;
type Field = (typeof FIELDS)[number];

export interface ItemFormState {
  fieldErrors?: Partial<Record<ItemField, string>>;
  formError?: string;
  /** What the owner typed, sent back after an error (React resets the form). */
  values?: Partial<Record<Field, string>>;
}

export async function addItemAction(_prev: ItemFormState, form: FormData): Promise<ItemFormState> {
  const values = Object.fromEntries(FIELDS.map((k) => [k, String(form.get(k) ?? '')])) as Record<Field, string>;
  const project = await getMyProject();
  if (!project) return { formError: qtyFailedAr.no_project, values };
  // The phase must be one of this project's (the database checks again, 0024).
  if (values.phaseId && !project.phases.some((p) => p.id === values.phaseId.trim().toLowerCase())) {
    return { fieldErrors: { phaseId: qtyErrorsAr.invalid_reference }, values };
  }
  const result = await addItem(supabaseQuantityStore(await createServerSupabase()), project.id, values);
  if (!result.ok) {
    if (result.kind === 'failed') return { formError: qtyFailedAr[result.reason], values };
    const fieldErrors: ItemFormState['fieldErrors'] = {};
    for (const e of result.errors) fieldErrors[e.field] ??= qtyErrorsAr[e.code as keyof typeof qtyErrorsAr];
    return { fieldErrors, values };
  }
  revalidatePath(MATERIALS_PATH, 'layout');
  redirect(`${itemPath(result.id)}?done=added`);
}

/** Bound to one line. A line with purchases stays (the database refuses it too). */
export async function deleteItemAction(itemId: string): Promise<void> {
  const project = await getMyProject();
  if (!project) redirect(MATERIALS_PATH);
  const result = await deleteItem(supabaseQuantityStore(await createServerSupabase()), project.id, itemId);
  revalidatePath(MATERIALS_PATH, 'layout');
  redirect(result.status === 'done' ? `${MATERIALS_PATH}?done=deleted` : `${itemPath(itemId)}?done=not_deleted`);
}
